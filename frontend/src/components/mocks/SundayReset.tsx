import React, { useCallback, useEffect, useState } from 'react'
import { RotateCcw, X, Lock, CalendarClock, Wrench } from 'lucide-react'
import type { Mistake, MistakeGrade } from '../../types'
import { renderMarkdown } from '../../lib/markdown'
import { rootCauseLabel } from '../../lib/examTemplates'
import { Button } from '../ui/Button'

interface Props {
  deck: Mistake[]
  onGrade: (id: number, grade: MistakeGrade) => Promise<Mistake>
  onClose: (summary: { reviewed: number; locked: number; drill: number }) => void
}

const GRADES: { value: MistakeGrade; label: string; key: string; icon: React.ElementType; tone: string }[] = [
  { value: 'locked_in', label: 'Locked in', key: '1', icon: Lock, tone: 'border-brand-500/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20' },
  { value: 'review_next_week', label: 'Review next week', key: '2', icon: CalendarClock, tone: 'border-accent-sky/30 bg-accent-sky/10 text-sky-200 hover:bg-accent-sky/20' },
  { value: 'needs_drill', label: 'Needs concept drill', key: '3', icon: Wrench, tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' },
]

/** Full-screen weekly revision of logged mistakes. Space flips, 1–3 grades, Escape ends. */
export const SundayReset: React.FC<Props> = ({ deck, onGrade, onClose }) => {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState({ reviewed: 0, locked: 0, drill: 0 })
  const current = deck[index]

  const finish = useCallback(() => onClose(tally), [onClose, tally])

  const grade = useCallback(
    async (g: MistakeGrade) => {
      if (!current || busy) return
      setBusy(true)
      try {
        await onGrade(current.id, g)
        setTally((t) => ({ reviewed: t.reviewed + 1, locked: t.locked + (g === 'locked_in' ? 1 : 0), drill: t.drill + (g === 'needs_drill' ? 1 : 0) }))
        setIndex((i) => i + 1)
        setFlipped(false)
      } catch {
        /* surfaced by caller */
      } finally {
        setBusy(false)
      }
    },
    [current, busy, onGrade],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      } else if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && /^[1-3]$/.test(e.key)) {
        e.preventDefault()
        void grade(GRADES[Number(e.key) - 1].value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, grade, finish])

  useEffect(() => {
    if (index >= deck.length) finish()
  }, [index, deck.length, finish])

  if (!current) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface-950/95 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true" aria-label="Sunday Reset">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-5">
        <div>
          <p className="eyebrow">Sunday Reset</p>
          <p className="mt-0.5 text-sm text-ink-400"><span className="font-mono tabular-nums text-ink-50">{index + 1}</span> / {deck.length} mistakes</p>
        </div>
        <button type="button" onClick={finish} aria-label="End Sunday Reset" className="focus-ring glass flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-ink-300 hover:text-ink-50">
          <X className="h-3.5 w-3.5" aria-hidden="true" /> End
        </button>
      </div>
      <div className="mx-auto mt-4 h-1 w-full max-w-3xl overflow-hidden rounded-full bg-fg/[0.06]">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${(index / deck.length) * 100}%` }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-6">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
          aria-label={flipped ? 'Showing your rule. Click to see the trap.' : 'Showing the trap. Click to reveal your rule.'}
          className="card focus-ring flex min-h-[320px] w-full max-w-3xl flex-col items-center justify-center p-8 text-center sm:p-12"
        >
          <div className="mb-4 flex flex-wrap justify-center gap-1.5">
            <span className="chip border-fg/[0.08] bg-fg/[0.04] text-ink-200">{current.subject}</span>
            <span className="chip border-fg/[0.08] bg-fg/[0.04] text-ink-200">{current.pattern}</span>
            <span className="chip border-fg/[0.06] bg-fg/[0.03] text-ink-400">{rootCauseLabel(current.root_cause)}</span>
          </div>
          {flipped ? (
            <>
              <span className="eyebrow mb-3">Your execution rule</span>
              <div className="prose-card max-w-none text-lg leading-relaxed text-ink-50" dangerouslySetInnerHTML={{ __html: renderMarkdown(current.rule || '_No rule written yet. Edit this mistake to add one._') }} />
              {current.solution && <div className="prose-card mt-5 max-w-none border-t border-fg/[0.06] pt-4 text-sm text-ink-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(current.solution) }} />}
            </>
          ) : (
            <>
              <span className="eyebrow mb-3">The trap</span>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink-50">{current.question || 'No question text logged.'}</p>
              {current.actual_seconds !== null && current.ideal_seconds !== null && (
                <p className="mt-4 text-xs text-ink-500">Took {current.actual_seconds}s against an ideal {current.ideal_seconds}s</p>
              )}
              <span className="mt-8 text-xs text-ink-500">Recall your rule, then press Space</span>
            </>
          )}
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-8">
        {flipped ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {GRADES.map((g) => {
              const Icon = g.icon
              return (
                <button key={g.value} type="button" disabled={busy} onClick={() => void grade(g.value)} className={`focus-ring flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-50 ${g.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {g.label}
                  <kbd className="font-mono text-[10px] font-normal opacity-60">{g.key}</kbd>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex justify-center">
            <Button size="xl" onClick={() => setFlipped(true)} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>Show my rule</Button>
          </div>
        )}
      </div>
    </div>
  )
}
