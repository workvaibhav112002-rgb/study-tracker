import React, { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import type { Project } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { StarRating } from './ui/StarRating'
import { formatDurationSeconds } from '../lib/time'

interface SessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (projectId: number, rating: number, notes: string) => Promise<void>
  durationSeconds: number
  projects: Project[]
  defaultProjectId: number | null
}

/** Post-pomodoro log. Project is editable so a session is never lost. */
export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  durationSeconds,
  projects,
  defaultProjectId,
}) => {
  const [projectId, setProjectId] = useState<number | ''>('')
  const [rating, setRating] = useState(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setProjectId(defaultProjectId ?? projects[0]?.id ?? '')
    setRating(5)
    setNotes('')
    setSaving(false)
  }, [isOpen, defaultProjectId, projects])

  const project = projects.find((p) => p.id === projectId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (projectId === '') return
    setSaving(true)
    try {
      await onSave(projectId, rating, notes.trim())
    } catch {
      /* error surfaced by caller; keep the form open */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      title="Pomodoro Completed!"
      description="Great focus block. Log your progress below."
      icon={<Check className="w-5 h-5" />}
      iconClassName="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    >
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 mb-5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project?.color || '#3b82f6' }} aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-200 truncate">{project?.name || 'Select a project'}</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{formatDurationSeconds(durationSeconds)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Project">
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

        <div>
          <span className="block text-xs font-semibold text-slate-300 mb-2">How focused were you? (1-5)</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <Field label="Study Notes / What did you accomplish?">
          {(id) => (
            <textarea
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Read chapters 3-4, wrote unit tests for the repository layer..."
              rows={3}
              maxLength={2000}
              className={`${inputClass} resize-none`}
            />
          )}
        </Field>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Skip Logging
          </Button>
          <Button type="submit" loading={saving} disabled={projectId === ''}>
            Save Study Session
          </Button>
        </div>
      </form>
    </Modal>
  )
}
