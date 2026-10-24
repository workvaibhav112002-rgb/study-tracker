import React from 'react'
import { CalendarCheck, Flame, Sparkles, Star, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { WeeklyReview } from '../types'
import { formatMinutes } from '../lib/time'

interface Props {
  review: WeeklyReview
}

const dayLabel = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
const range = (r: WeeklyReview) => {
  const f = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${f(r.week_start)} – ${f(r.week_end)}`
}

export const WeeklyReviewCard: React.FC<Props> = ({ review: r }) => {
  const Delta = r.delta_percent === null ? Minus : r.delta_percent >= 0 ? TrendingUp : TrendingDown
  const peak = Math.max(1, ...r.days.map((d) => d.minutes))
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-label="Weekly review">
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Weekly review</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink-50">{range(r)}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip border-brand-500/20 bg-brand-500/10 font-mono tabular-nums text-brand-300">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {formatMinutes(r.minutes)}
          </span>
          {r.delta_percent !== null && (
            <span className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-300">
              <Delta className="h-3.5 w-3.5" aria-hidden="true" />
              {r.delta_percent >= 0 ? '+' : ''}
              {Math.round(r.delta_percent)}% vs prior week
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <ul className="space-y-2.5 lg:col-span-3">
          {r.insights.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-200">
              <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
        <div className="lg:col-span-2">
          <div className="flex h-24 items-end gap-1.5" role="img" aria-label="Minutes per day for the week">
            {r.days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-16 w-full items-end">
                  <div
                    className={`w-full rounded-t-[3px] ${d.minutes > 0 ? 'bg-gradient-to-t from-brand-600 to-brand-300' : 'bg-fg/[0.05]'}`}
                    style={{ height: `${Math.max(d.minutes > 0 ? 8 : 3, (d.minutes / peak) * 100)}%` }}
                    title={`${dayLabel(d.date)}: ${formatMinutes(d.minutes)}`}
                  />
                </div>
                <span className="text-[10px] text-ink-500">{dayLabel(d.date).slice(0, 2)}</span>
              </div>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-2">
              <dt className="eyebrow flex items-center justify-center gap-1"><Flame className="h-3 w-3 text-orange-400" aria-hidden="true" />Streak</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-ink-50">{r.streak_days}d</dd>
            </div>
            <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-2">
              <dt className="eyebrow flex items-center justify-center gap-1"><Star className="h-3 w-3 text-accent-amber" aria-hidden="true" />Focus</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-ink-50">{r.avg_rating ? r.avg_rating.toFixed(1) : '—'}</dd>
            </div>
            <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-2">
              <dt className="eyebrow flex items-center justify-center gap-1"><Zap className="h-3 w-3 text-accent-amber" aria-hidden="true" />Interrupt</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-ink-50">{r.sessions ? r.avg_interruptions.toFixed(1) : '—'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
