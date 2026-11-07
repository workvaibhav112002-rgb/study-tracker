import React, { useEffect, useState } from 'react'
import { PencilLine } from 'lucide-react'
import type { Session } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { StarRating } from './ui/StarRating'
import { formatDateTime, formatDurationSeconds } from '../lib/time'

/** Same limit the server enforces on session notes. */
export const MAX_SESSION_NOTES = 2000

interface EditSessionModalProps {
  session: Session | null
  onClose: () => void
  onSave: (id: number, changes: { focus_rating?: number; notes?: string }) => Promise<void>
}

/** Edit the notes and focus rating of a session that is already saved. */
export const EditSessionModal: React.FC<EditSessionModalProps> = ({ session, onClose, onSave }) => {
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(3)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    setNotes(session.notes ?? '')
    setRating(session.focus_rating || 3)
    setSaving(false)
  }, [session])

  if (!session) return null

  const originalNotes = session.notes ?? ''
  const notesChanged = notes.trim() !== originalNotes.trim()
  const ratingChanged = rating !== session.focus_rating
  const tooLong = notes.length > MAX_SESSION_NOTES
  const canSave = (notesChanged || ratingChanged) && !tooLong && !saving

  const save = async () => {
    if (!canSave) return
    const changes: { focus_rating?: number; notes?: string } = {}
    if (notesChanged) changes.notes = notes.trim()
    if (ratingChanged) changes.focus_rating = rating
    setSaving(true)
    try {
      await onSave(session.id, changes)
      onClose()
    } catch {
      // The caller shows the error; keep the text so nothing is lost.
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={saving ? undefined : onClose}
      title="Edit session"
      description={`${session.project_name ?? 'Project'} · ${formatDateTime(session.start_time)} · ${formatDurationSeconds(session.duration_seconds)}`}
      icon={<PencilLine className="h-5 w-5" aria-hidden="true" />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="space-y-5"
      >
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-300">Focus</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <Field
          label="Notes"
          error={tooLong ? `Keep notes under ${MAX_SESSION_NOTES} characters.` : null}
          hint={`${notes.length} / ${MAX_SESSION_NOTES} · Ctrl+Enter to save`}
        >
          {(id, describedBy) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={tooLong || undefined}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void save()
                }
              }}
              rows={6}
              placeholder="What did you work on? What got in the way?"
              className="input min-h-[8rem] resize-y py-2.5 leading-relaxed"
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
