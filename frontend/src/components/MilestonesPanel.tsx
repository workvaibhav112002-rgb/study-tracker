import React from 'react'
import { Sparkles, Timer, Clock, Flame, Target, Layers, Brain, NotebookPen, Lock, type LucideIcon } from 'lucide-react'
import type { Milestone } from '../types'

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  timer: Timer,
  clock: Clock,
  flame: Flame,
  target: Target,
  layers: Layers,
  brain: Brain,
  notebook: NotebookPen,
}

interface Props {
  milestones: Milestone[]
}

/** Badge grid: achieved ones glow, the rest show progress toward the target. */
export const MilestonesPanel: React.FC<Props> = ({ milestones }) => {
  const achieved = milestones.filter((m) => m.achieved).length
  return (
    <section className="card p-5 sm:p-6" aria-label="Milestones">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Milestones</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink-50">
            {achieved} of {milestones.length} unlocked
          </h3>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="list">
        {milestones.map((m) => {
          const Icon = ICONS[m.icon] ?? Sparkles
          const pct = m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0
          return (
            <li
              key={m.id}
              className={`relative rounded-2xl border p-4 transition ${m.achieved ? 'border-brand-500/30 bg-brand-500/10' : 'border-fg/[0.06] bg-fg/[0.03]'}`}
              aria-label={`${m.title}: ${m.achieved ? 'achieved' : `${m.progress} of ${m.target}`}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${m.achieved ? 'border-brand-400/30 bg-brand-400/15 text-brand-300' : 'border-fg/[0.06] bg-fg/[0.04] text-ink-500'}`}>
                {m.achieved ? <Icon className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
              </span>
              <p className={`mt-3 text-[13px] font-semibold ${m.achieved ? 'text-ink-50' : 'text-ink-200'}`}>{m.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{m.description}</p>
              {!m.achieved && (
                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-fg/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.progress}>
                    <div className="h-full rounded-full bg-brand-500/70" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] font-mono tabular-nums text-ink-500">
                    {m.progress}/{m.target}
                  </p>
                </div>
              )}
              {m.achieved && m.achieved_at && <p className="mt-2 text-[10px] text-ink-500">since {m.achieved_at}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
