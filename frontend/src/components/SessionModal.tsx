import React, { useEffect, useState } from 'react'
import { Check, Clock, Zap } from 'lucide-react'
import type { Project, Task } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { StarRating } from './ui/StarRating'
import { formatDurationSeconds } from '../lib/time'

interface SessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (projectId: number, rating: number, notes: string, taskId: number | null) => Promise<void>
  durationSeconds: number
  interruptions: number
  projects: Project[]
  tasks: Task[]
  defaultProjectId: number | null
  defaultTaskId: number | null
}

/** Post-pomodoro log. Project and task are editable so a session is never lost. */
export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  durationSeconds,
  interruptions,
  projects,
  tasks,
  defaultProjectId,
  defaultTaskId,
}) => {
  const [projectId, setProjectId] = useState<number | ''>('')
  const [taskId, setTaskId] = useState<number | ''>('')
  const [rating, setRating] = useState(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setProjectId(defaultProjectId ?? projects[0]?.id ?? '')
    setTaskId(defaultTaskId ?? '')
    setRating(5)
    setNotes('')
    setSaving(false)
  }, [isOpen, defaultProjectId, defaultTaskId, projects])

  const project = projects.find((p) => p.id === projectId)
  const projectTasks = tasks.filter((t) => t.project_id === projectId && !t.done)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (projectId === '') return
    setSaving(true)
    try {
      await onSave(projectId, rating, notes.trim(), taskId === '' ? null : taskId)
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
      title="Session complete"
      description="Nice work. Log how it went."
      icon={<Check className="h-5 w-5" />}
      iconClassName="bg-brand-500/10 text-brand-400 border-brand-500/20"
    >
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project?.color || '#3987e5', boxShadow: `0 0 10px ${project?.color || '#3987e5'}` }} aria-hidden="true" />
          <span className="truncate text-sm font-medium text-ink-100">{project?.name || 'Select a project'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {interruptions > 0 && (
            <span className="chip border-accent-amber/20 bg-accent-amber/10 text-amber-200" title="Pauses and tab switches during this session">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              {interruptions} interruption{interruptions === 1 ? '' : 's'}
            </span>
          )}
          <span className="chip border-brand-500/20 bg-brand-500/10 font-mono tabular-nums text-brand-300">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDurationSeconds(durationSeconds)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project">
            {(id) => (
              <select
                id={id}
                value={projectId}
                onChange={(e) => {
                  setProjectId(Number(e.target.value))
                  setTaskId('')
                }}
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
          <Field label="Task (optional)">
            {(id) => (
              <select id={id} value={taskId} onChange={(e) => setTaskId(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} disabled={projectTasks.length === 0}>
                <option value="">{projectTasks.length === 0 ? 'No open tasks' : 'No task'}</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium text-ink-300">How focused were you?</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <Field label="Notes">
          {(id) => <textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you get done?" rows={3} maxLength={2000} className={`${inputClass} resize-none`} />}
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Skip
          </Button>
          <Button type="submit" loading={saving} disabled={projectId === ''}>
            Save session
          </Button>
        </div>
      </form>
    </Modal>
  )
}
