import React, { useState } from 'react'
import { Flame, Snowflake, Trophy, Check } from 'lucide-react'
import type { GoalStreak } from '../types'
import { Button } from './ui/Button'
import { formatMinutes } from '../lib/time'

interface Props {
  streak: GoalStreak
  onFreeze: () => Promise<void>
}

const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

/**
 * Goal streak with the weekly freeze. The freeze is offered only when
 * yesterday was missed and the week's freeze is still unspent.
 */
export const StreakCard: React.FC<Props> = ({ streak, onFreeze }) => {
  const [freezing, setFreezing] = useState(false)
  const canFreeze = streak.target_minutes > 0 && !streak.yesterday_met && streak.freeze_available && streak.missed_yesterday !== ''
  const atRisk = streak.target_minutes > 0 && !streak.today_met && streak.days > 0

  const handleFreeze = async () => {
    setFreezing(true)
    try {
      await onFreeze()
    } finally {
      setFreezing(false)
    }
  }

  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-label="Goal streak">
      <span aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-400">
            <Flame className="h-7 w-7 fill-current" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Goal streak</p>
            <p className="mt-0.5 text-3xl font-semibold tracking-tight text-ink-50 tabular-nums">
              {streak.days}
              <span className="ml-1 text-base font-medium text-ink-400">{streak.days === 1 ? 'day' : 'days'}</span>
            </p>
          </div>
        </div>
        <dl className="flex gap-5 text-right">
          <div>
            <dt className="eyebrow flex items-center justify-end gap-1">
              <Trophy className="h-3 w-3 text-amber-400" aria-hidden="true" />
              Best
            </dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-ink-50">{streak.best_days}d</dd>
          </div>
          <div>
            <dt className="eyebrow">Daily goal</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-ink-50">{streak.target_minutes > 0 ? formatMinutes(streak.target_minutes) : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px]">
        {streak.target_minutes === 0 ? (
          <p className="text-ink-400">Set a daily target on a project to start a goal streak.</p>
        ) : streak.today_met ? (
          <p className="flex items-center gap-1.5 text-emerald-300">
            <Check className="h-4 w-4" aria-hidden="true" />
            Today&apos;s goal is done. Streak safe.
          </p>
        ) : (
          <p className="text-ink-300">{atRisk ? 'Hit your goal today to keep the streak alive.' : 'Hit your goal today to start a streak.'}</p>
        )}
        {canFreeze && (
          <Button size="sm" variant="secondary" onClick={handleFreeze} loading={freezing} icon={<Snowflake className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />}>
            Freeze {fmtDay(streak.missed_yesterday)}
          </Button>
        )}
        {!canFreeze && streak.target_minutes > 0 && (
          <span className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-400" title="One freeze per week covers a missed day">
            <Snowflake className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
            {streak.freeze_available ? 'Freeze ready' : 'Freeze used this week'}
          </span>
        )}
      </div>
    </section>
  )
}
