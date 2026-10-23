import React, { useEffect, useState } from 'react'
import { PlusCircle } from 'lucide-react'
import type { Project, SessionInput } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { StarRating } from './ui/StarRating'
import { localDateAt, localDateString } from '../lib/time'

interface ManualSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (session: SessionInput) => Promise<void>
  projects: Project[]
}

export const ManualSessionModal: React.FC<ManualSessionModalProps> = ({ isOpen, onClose, onSave, projects }) => {
  const [projectId, setProjectId] = useState<number | ''>('')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [rating, setRating] = useState(5)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(localDateString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setProjectId(projects[0]?.id ?? '')
    setDurationMinutes(45)
    setRating(5)
    setNotes('')
    setDate(localDateString())
    setError(null)
    setSaving(false)
  }, [isOpen, projects])

  const today = localDateString()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (projectId === '') return
    if (date > today) {
      setError('The date cannot be in the future.')
      return
    }
    const minutes = Math.round(durationMinutes)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      setError('Duration must be between 1 and 1440 minutes.')
      return
    }

    // Today's entries end now; past days are anchored at local noon.
    const durationMs = minutes * 60_000
    let start: Date
    let end: Date
    if (date === today) {
      end = new Date()
      start = new Date(end.getTime() - durationMs)
    } else {
      const noon = localDateAt(date, 12)
      if (!noon) {
        setError('Please enter a valid date.')
        return
      }
      start = noon
      end = new Date(noon.getTime() + durationMs)
    }

    setSaving(true)
    try {
      await onSave({
        project_id: projectId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_seconds: minutes * 60,
        session_type: 'manual',
        focus_rating: rating,
        notes: notes.trim(),
      })
      onClose()
    } catch {
      /* surfaced by caller */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      title="Log Study Session"
      description="Add an offline or past study block."
      icon={<PlusCircle className="w-5 h-5" />}
      iconClassName="bg-brand-500/10 text-brand-400 border-brand-500/20"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Project" hint={projects.length === 0 ? 'Create a project before logging time.' : undefined}>
          {(id) => (
            <select
              id={id}
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className={inputClass}
              required
              disabled={projects.length === 0}
            >
              {projects.length === 0 && <option value="">No projects yet</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            {(id) => (
              <input id={id} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
            )}
          </Field>
          <Field label="Duration (mins)">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={1440}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className={inputClass}
                required
              />
            )}
          </Field>
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-300 mb-1.5">Focus Rating</span>
          <StarRating value={rating} onChange={setRating} size="sm" showLabel={false} />
        </div>

        <Field label="Notes">
          {(id) => (
            <textarea
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you study?"
              rows={2}
              maxLength={2000}
              className={`${inputClass} resize-none`}
            />
          )}
        </Field>

        {error && (
          <p role="alert" className="text-xs text-rose-400 font-medium">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={projectId === ''}>
            Add Entry
          </Button>
        </div>
      </form>
    </Modal>
  )
}
