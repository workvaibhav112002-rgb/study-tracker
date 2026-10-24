import React, { useEffect, useMemo, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import type { Card, CardRating } from '../types'
import { renderMarkdown } from '../lib/markdown'
import { Button } from './ui/Button'

interface Props {
  cards: Card[]
  projectName: string
  onRate: (id: number, rating: CardRating) => Promise<Card>
  onClose: (summary: { reviewed: number; again: number; seconds: number }) => void
}

const RATINGS: { value: CardRating; label: string; key: string; tone: string }[] = [
  { value: 1, label: 'Again', key: '1', tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' },
  { value: 2, label: 'Hard', key: '2', tone: 'border-accent-amber/30 bg-accent-amber/10 text-amber-200 hover:bg-accent-amber/20' },
  { value: 3, label: 'Good', key: '3', tone: 'border-brand-500/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20' },
  { value: 4, label: 'Easy', key: '4', tone: 'border-accent-sky/30 bg-accent-sky/10 text-sky-200 hover:bg-accent-sky/20' },
]

/** Full-screen flashcard review: Space flips, 1–4 rates, Escape ends. */
export const ReviewMode: React.FC<Props> = ({ cards, projectName, onRate, onClose }) => {
  const [queue, setQueue] = useState<Card[]>(cards)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [again, setAgain] = useState(0)
  const [busy, setBusy] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const current = queue[0]
  const total = cards.length

  const finish = useMemo(() => () => onClose({ reviewed, again, seconds: Math.round((Date.now() - startedAt) / 1000) }), [onClose, reviewed, again, startedAt])

  const rate = async (rating: CardRating) => {
    if (!current || busy) return
    setBusy(true)
    try {
      await onRate(current.id, rating)
      setReviewed((n) => n + 1)
      if (rating === 1) {
        setAgain((n) => n + 1)
        setQueue((q) => [...q.slice(1), current])
      } else {
        setQueue((q) => q.slice(1))
      }
      setFlipped(false)
    } catch {
      /* surfaced by caller */
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      } else if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        void rate(Number(e.key) as CardRating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, current, busy, finish])

  useEffect(() => {
    if (queue.length === 0) finish()
  }, [queue.length, finish])

  if (!current) return null
  const done = total - queue.length + (again > 0 ? 0 : 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-950/95 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true" aria-label={`Reviewing ${projectName}`}>
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-5">
        <div>
          <p className="eyebrow">{projectName}</p>
          <p className="mt-0.5 text-sm text-ink-400">
            <span className="font-mono tabular-nums text-ink-50">{Math.min(done, total)}</span> / {total} cards · {queue.length} left
          </p>
        </div>
        <button type="button" onClick={finish} aria-label="End review" className="focus-ring glass flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-ink-300 hover:text-ink-50">
          <X className="h-3.5 w-3.5" aria-hidden="true" /> End
        </button>
      </div>
      <div className="mx-auto mt-4 h-1 w-full max-w-3xl overflow-hidden rounded-full bg-fg/[0.06] px-0">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${total ? (Math.min(done, total) / total) * 100 : 0}%` }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-5">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
          aria-label={flipped ? 'Showing answer. Click to see question.' : 'Showing question. Click to reveal answer.'}
          className="card focus-ring flex min-h-[320px] w-full max-w-3xl flex-col items-center justify-center p-8 text-center transition-transform duration-200 hover:scale-[1.005] sm:p-12"
        >
          <span className="eyebrow mb-4">{flipped ? 'Answer' : 'Question'}</span>
          <div className="prose-card max-w-none text-lg leading-relaxed text-ink-50" dangerouslySetInnerHTML={{ __html: renderMarkdown(flipped ? current.back : current.front) }} />
          {!flipped && <span className="mt-8 text-xs text-ink-500">Press Space or click to reveal</span>}
          {current.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-1.5">
              {current.tags.map((t) => (
                <span key={t} className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-400">#{t}</span>
              ))}
            </div>
          )}
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-8">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button key={r.value} type="button" disabled={busy} onClick={() => void rate(r.value)} className={`focus-ring flex flex-col items-center rounded-2xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-50 ${r.tone}`}>
                {r.label}
                <kbd className="mt-1 font-mono text-[10px] font-normal opacity-60">{r.key}</kbd>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <Button size="xl" onClick={() => setFlipped(true)} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
              Show answer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
