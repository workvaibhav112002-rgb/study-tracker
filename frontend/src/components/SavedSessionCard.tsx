import React, { useEffect, useRef, useState } from 'react'
import { Check, CloudOff, Loader2, Undo2, X, PencilLine } from 'lucide-react'
import { StarRating } from './ui/StarRating'
import { Button } from './ui/Button'
import { inputClass } from './ui/Field'
import { formatMinutes } from '../lib/time'

export interface SavedCardState {
  key: string
  status: 'saving' | 'saved' | 'waiting'
  sessionId: number | null
  minutes: number
  projectName: string
  projectColor: string
  rating: number
}

interface Props {
  state: SavedCardState
  onRate: (rating: number) => void
  onNote: (note: string) => Promise<void>
  onUndo: () => void
  onClose: () => void
}

const AUTO_HIDE_MS = 15_000

/**
 * Shown instead of a dialog when a focus session ends: the session is already
 * saved, and rating, a note or undo are optional. Hides itself after a while
 * unless the user is interacting with it.
 */
export const SavedSessionCard: React.FC<Props> = ({ state, onRate, onNote, onUndo, onClose }) => {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (engaged || noteOpen || state.status !== 'saved') return
    const t = window.setTimeout(onClose, AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [engaged, noteOpen, state.status, onClose])

  const title =
    state.status === 'saving' ? 'Saving…' : state.status === 'waiting' ? 'Saved on this device' : `Saved ${formatMinutes(state.minutes)} to ${state.projectName}`

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-16 z-40 flex justify-center sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-20">
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-label="Session saved"
      data-testid="saved-session-card"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      className="glass pointer-events-auto w-full rounded-3xl border border-fg/[0.08] p-4 shadow-modal animate-fade-up sm:w-[26rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-fg/[0.08]" style={{ background: `${state.projectColor}22`, color: state.projectColor }}>
            {state.status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : state.status === 'waiting' ? <CloudOff className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-50">{title}</p>
            <p className="text-[11px] text-ink-500">
              {state.status === 'waiting' ? `${formatMinutes(state.minutes)} on ${state.projectName}. It will sync as soon as you are back online.` : 'Rate it if you like. Nothing else to do.'}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="focus-ring rounded-lg p-1 text-ink-500 hover:text-ink-50"><X className="h-4 w-4" /></button>
      </div>

      {state.status === 'saved' && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <StarRating value={state.rating} onChange={(v) => { setEngaged(true); onRate(v) }} size="sm" label="How focused were you?" showLabel={false} />
            <div className="flex items-center gap-1">
              {!noteOpen && <Button size="sm" variant="ghost" onClick={() => { setEngaged(true); setNoteOpen(true) }} icon={<PencilLine className="h-3.5 w-3.5" aria-hidden="true" />}>Add note</Button>}
              <Button size="sm" variant="ghost" onClick={onUndo} icon={<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}>Undo</Button>
            </div>
          </div>
          {noteOpen && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!note.trim()) return
                setSavingNote(true)
                try {
                  await onNote(note.trim())
                  setNoteOpen(false)
                  setEngaged(false)
                } finally {
                  setSavingNote(false)
                }
              }}
            >
              <input autoFocus aria-label="Session note" className={`${inputClass} h-9 py-0 text-[13px]`} maxLength={2000} placeholder="What did you work on?" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" type="submit" loading={savingNote} disabled={!note.trim()}>Save</Button>
            </form>
          )}
        </>
      )}
      {state.status === 'waiting' && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onUndo} icon={<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}>Discard</Button>
        </div>
      )}
    </div>
    </div>
  )
}
