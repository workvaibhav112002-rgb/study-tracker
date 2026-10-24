import React, { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import type { Settings } from '../../types'
import { api, errorMessage } from '../../api/client'
import { currentSubscription, subscribePush, supportsPush, unsubscribePush } from '../../lib/push'
import { browserTimeZone } from '../../lib/time'
import { useToast } from '../ui/Toast'
import { Field, inputClass } from '../ui/Field'

interface Props {
  form: Settings
  setForm: (next: Settings) => void
  vapidPublicKey: string
  /** Shared toggle component from the settings modal, for a consistent look. */
  Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }>
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'am' : 'pm'}`

/**
 * Daily reminder preferences. The hour and timezone are saved with the rest
 * of the settings form; the push subscription is registered immediately
 * because it needs a user gesture for the permission prompt.
 */
export const RemindersSection: React.FC<Props> = ({ form, setForm, vapidPublicKey, Toggle }) => {
  const toast = useToast()
  const enabled = supportsPush() && vapidPublicKey !== ''
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void currentSubscription().then((s) => {
      if (!cancelled) setSubscribed(Boolean(s))
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  const togglePush = async (on: boolean) => {
    setBusy(true)
    try {
      if (on) {
        const keys = await subscribePush(vapidPublicKey)
        if (!keys) {
          toast.error('Notifications are blocked or unsupported in this browser.')
          return
        }
        await api.pushSubscribe(keys)
        setSubscribed(true)
        const tz = browserTimeZone()
        setForm({ ...form, reminder_enabled: true, timezone: tz || form.timezone })
        toast.success('This device will get reminders. Save to apply the time.')
      } else {
        const endpoint = await unsubscribePush()
        if (endpoint) await api.pushUnsubscribe(endpoint).catch(() => undefined)
        setSubscribed(false)
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update reminders.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <h3 className="eyebrow pt-2">Reminders</h3>
      {!enabled && <p className="text-[12px] text-ink-500">Push reminders are not available here. They need a browser with push support and a server with VAPID keys configured.</p>}
      <Toggle
        checked={form.reminder_enabled}
        onChange={(v) => setForm({ ...form, reminder_enabled: v, timezone: v ? browserTimeZone() || form.timezone : form.timezone })}
        label="Daily nudge if I have not studied"
        hint={`Sent once a day at the hour below, ${form.timezone} time.`}
      />
      {form.reminder_enabled && (
        <Field label="Remind me at">
          {(id) => (
            <select id={id} value={form.reminder_hour} onChange={(e) => setForm({ ...form, reminder_hour: Number(e.target.value) })} className={inputClass}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {enabled && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] px-4 py-3">
          <span className="flex items-center gap-2.5">
            <BellRing className="h-4 w-4 text-brand-400" aria-hidden="true" />
            <span>
              <span className="block text-[13px] font-medium text-ink-100">Push to this device</span>
              <span className="block text-[11px] text-ink-500">{subscribed ? 'Subscribed. Reminders arrive even when the app is closed.' : 'Allow notifications to receive the nudge here.'}</span>
            </span>
          </span>
          <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={subscribed} disabled={busy} onChange={(e) => void togglePush(e.target.checked)} aria-label="Push reminders on this device" />
        </label>
      )}
    </div>
  )
}
