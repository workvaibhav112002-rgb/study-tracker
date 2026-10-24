import React, { useState } from 'react'
import { CalendarDays, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'

interface Props {
  hasToken: boolean
  onChanged: () => Promise<void> | void
}

export const CalendarSyncSection: React.FC<Props> = ({ hasToken, onChanged }) => {
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const res = await api.createCalendarToken()
      setUrl(api.calendarUrl(res.token))
      await onChanged()
      toast.success(hasToken ? 'Calendar link regenerated. The old one no longer works.' : 'Calendar link created.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <section aria-labelledby="calendar-sync" className="space-y-3">
      <div>
        <h3 id="calendar-sync" className="eyebrow">
          Calendar sync
        </h3>
        <p className="mt-1 text-xs text-ink-500">Subscribe in Google or Apple Calendar to see your sessions as events. Anyone with the link can read them.</p>
      </div>
      {url ? (
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/[0.06] p-3">
          <p className="mb-2 text-[11px] font-medium text-brand-300">Copy this link now. It is shown only once.</p>
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="input h-9 py-0 font-mono text-[11px]" aria-label="Calendar subscription link" />
            <Button size="sm" variant="secondary" onClick={copy} icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}>
              Copy
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${hasToken ? 'border-brand-500/20 bg-brand-500/10 text-brand-300' : 'border-fg/[0.06] bg-fg/[0.04] text-ink-400'}`}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {hasToken ? 'Feed active' : 'Not set up'}
          </span>
          <Button size="sm" variant="secondary" loading={busy} onClick={generate} icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
            {hasToken ? 'Regenerate link' : 'Create link'}
          </Button>
          {hasToken && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(true)} icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}>
              Revoke
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmRevoke}
        title="Revoke calendar link?"
        message="Calendars subscribed with the current link will stop updating."
        confirmLabel="Revoke"
        onCancel={() => setConfirmRevoke(false)}
        onConfirm={async () => {
          try {
            await api.revokeCalendarToken()
            setUrl(null)
            await onChanged()
            toast.success('Calendar link revoked.')
            setConfirmRevoke(false)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </section>
  )
}
