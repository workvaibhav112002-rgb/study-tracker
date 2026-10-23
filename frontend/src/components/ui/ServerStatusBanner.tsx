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
      <div role="status" className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
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
    <div role="status" className="bg-sky-500/10 border-b border-sky-500/20 text-sky-200 text-xs">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Waking up the server, this can take up to a minute on the free tier…
      </div>
    </div>
  )
}
