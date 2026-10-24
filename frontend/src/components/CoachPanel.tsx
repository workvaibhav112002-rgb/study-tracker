import React, { useState } from 'react'
import { Sparkles, KeyRound, Send, Trash2 } from 'lucide-react'
import type { DashboardStats, GoalStreak, Project, WeeklyReview } from '../types'
import { askCoach, buildCoachPrompt, getCoachKey, looksLikeAnthropicKey, setCoachKey } from '../lib/coach'
import { renderMarkdown } from '../lib/markdown'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'

interface Props {
  stats: DashboardStats
  review: WeeklyReview | null
  streak: GoalStreak | null
  projects: Project[]
}

/** Bring-your-own-key coach: the key stays in this browser. */
export const CoachPanel: React.FC<Props> = ({ stats, review, streak, projects }) => {
  const [key, setKey] = useState(getCoachKey)
  const [draftKey, setDraftKey] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveKey = (e: React.FormEvent) => {
    e.preventDefault()
    const k = draftKey.trim()
    if (!looksLikeAnthropicKey(k)) {
      setError('That does not look like an Anthropic API key (they start with sk-ant-).')
      return
    }
    setCoachKey(k)
    setKey(k)
    setDraftKey('')
    setError(null)
  }

  const ask = async () => {
    setBusy(true)
    setError(null)
    setAnswer('')
    try {
      const out = await askCoach(key, buildCoachPrompt({ stats, review, streak, projects, question }), setAnswer)
      if (out.stop === 'refusal') setError('The model declined this request.')
      if (out.stop === 'max_tokens') setError('The reply was cut short.')
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(status === 401 ? 'Anthropic rejected the key. Check it and try again.' : status === 429 ? 'Rate limited by Anthropic. Try again in a minute.' : 'Could not reach Anthropic. Check your connection and key.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5 sm:p-6" aria-label="AI study coach">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">AI coach</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink-50">Ask about your numbers</h3>
          <p className="mt-1 text-xs text-ink-500">Uses your own Anthropic API key, stored only in this browser and sent only to Anthropic. Your stats go with each question; notes and cards do not.</p>
        </div>
        {key && (
          <button
            type="button"
            onClick={() => {
              setCoachKey('')
              setKey('')
              setAnswer('')
            }}
            className="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-ink-500 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Forget key
          </button>
        )}
      </div>

      {!key ? (
        <form onSubmit={saveKey} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Anthropic API key">{(id) => <input id={id} type="password" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} className={`${inputClass} font-mono`} placeholder="sk-ant-…" autoComplete="off" />}</Field>
          </div>
          <Button type="submit" icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}>
            Save in this browser
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className={`${inputClass} flex-1`} placeholder="How am I doing, and what should I change this week?" onKeyDown={(e) => e.key === 'Enter' && !busy && void ask()} />
            <Button onClick={() => void ask()} loading={busy} icon={<Send className="h-4 w-4" aria-hidden="true" />}>
              Ask
            </Button>
          </div>
          {answer && <div className="prose-card rounded-2xl border border-brand-500/20 bg-brand-500/[0.06] p-4 text-sm leading-relaxed text-ink-200" aria-live="polite" dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }} />}
          {!answer && !busy && (
            <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
              Each question is one short request to Claude at your own cost.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-300">
          {error}
        </p>
      )}
    </section>
  )
}
