import React from 'react'
import { Repeat, X } from 'lucide-react'
import type { RepeatAlert } from '../../types'
import { rootCauseLabel } from '../../lib/examTemplates'

interface Props {
  alerts: RepeatAlert[]
  onOpen: (a: RepeatAlert) => void
  onDismiss?: () => void
  compact?: boolean
}

/** Pinned warning for patterns that went wrong 3+ times with the same cause in 2 weeks. */
export const RepeatAlertBanner: React.FC<Props> = ({ alerts, onOpen, onDismiss, compact }) => {
  if (alerts.length === 0) return null
  const shown = compact ? alerts.slice(0, 1) : alerts.slice(0, 3)
  return (
    <div role="alert" className={`mb-4 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-xs text-rose-100 ${compact ? 'mx-auto max-w-2xl' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">#repeat-error {alerts.length > 1 ? `in ${alerts.length} patterns` : ''}</p>
            <ul className="mt-1 space-y-0.5">
              {shown.map((a) => (
                <li key={`${a.pattern}|${a.root_cause}`}>
                  <button type="button" onClick={() => onOpen(a)} className="focus-ring rounded text-left underline-offset-2 hover:underline">
                    {a.pattern}: {a.count}× {rootCauseLabel(a.root_cause).toLowerCase()} in the last 2 weeks
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss repeat-error alert" className="focus-ring rounded-lg p-1 text-rose-200/70 hover:text-rose-50"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  )
}
