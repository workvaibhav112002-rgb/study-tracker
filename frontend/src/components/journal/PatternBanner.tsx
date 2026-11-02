import React from 'react'
import { Repeat, X } from 'lucide-react'
import type { JournalConfig, PatternAlert } from '../../types'
import { describeAlert } from '../../lib/patterns'

interface Props {
  alerts: PatternAlert[]
  configFor: (projectId: number) => JournalConfig
  onOpen: (a: PatternAlert) => void
  onDismiss?: () => void
  compact?: boolean
}

/** Pinned warning for combinations that keep going wrong. */
export const PatternBanner: React.FC<Props> = ({ alerts, configFor, onOpen, onDismiss, compact }) => {
  if (alerts.length === 0) return null
  const shown = compact ? alerts.slice(0, 1) : alerts.slice(0, 3)
  return (
    <div role="alert" className={`mb-4 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-xs text-rose-100 ${compact ? 'mx-auto max-w-2xl' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">{alerts.length > 1 ? `${alerts.length} repeating mistakes` : 'Repeating mistake'}</p>
            <ul className="mt-1 space-y-0.5">
              {shown.map((a) => {
                const cfg = configFor(a.project_id)
                return (
                  <li key={`${a.project_id}|${a.categories.join(',')}|${a.values.join('|')}`}>
                    <button type="button" onClick={() => onOpen(a)} className="focus-ring rounded text-left underline-offset-2 hover:underline">
                      {describeAlert(cfg, a)}: {a.count}× in {cfg.patterns.window_days} days
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss repeating-mistake alert" className="focus-ring rounded-lg p-1 text-rose-200/70 hover:text-rose-50"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  )
}
