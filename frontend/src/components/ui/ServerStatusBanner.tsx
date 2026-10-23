import React, { useEffect, useState } from 'react'
import { Loader2, WifiOff } from 'lucide-react'
import { serverWakingEvents } from '../../api/client'
import type { AuthStatus } from '../../hooks/useAuth'

interface Props {
  authStatus: AuthStatus
  onRetry: () => void
}

/**
 * Surfaces slow responses (free-tier cold start) and unreachable states so a
 * long first request never looks like a frozen app.
 */
export const ServerStatusBanner: React.FC<Props> = ({ authStatus, onRetry }) => {
  const [waking, setWaking] = useState(false)
  useEffect(() => serverWakingEvents.on(setWaking), [])

  if (authStatus === 'unreachable') {
    return (
      <div role="status" className="border-b border-accent-amber/20 bg-accent-amber/10 text-xs text-amber-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <span className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            Cannot reach the server right now. It may be waking up; retrying automatically.
          </span>
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2 hover:text-white">
            Retry now
          </button>
        </div>
      </div>
    )
  }

  if (!waking) return null
  return (
    <div role="status" className="border-b border-accent-sky/20 bg-accent-sky/10 text-xs text-sky-200">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Waking up the server, this can take up to a minute on the free tier…
      </div>
    </div>
  )
}
