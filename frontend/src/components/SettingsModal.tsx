import React, { useEffect, useState } from 'react'
import { SlidersHorizontal, Volume2 } from 'lucide-react'
import { SETTINGS_LIMITS, type AuthResponse, type Settings, type User } from '../types'
import { useLocalPrefs } from '../hooks/useLocalPrefs'
import { permission, requestPermission, supportsNotifications } from '../lib/notify'
import { CalendarSyncSection } from './settings/CalendarSyncSection'
import { ImportSection } from './settings/ImportSection'
import { AccountSection } from './settings/AccountSection'
import { audioService } from '../services/audio'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => Promise<void>
  user: User | null
  onUserChanged: () => Promise<void> | void
  onDataChanged: () => Promise<void> | void
  onPasswordChanged: (res: AuthResponse) => void
  onAccountDeleted: () => void
}

type NumericKey = keyof typeof SETTINGS_LIMITS

const labels: Record<NumericKey, string> = {
  work_duration: 'Focus',
  short_break_duration: 'Short break',
  long_break_duration: 'Long break',
  long_break_interval: 'Pomodoros before a long break',
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
    <span>
      <span className="block text-[13px] font-medium text-ink-100">{label}</span>
      {hint && <span className="block text-[11px] text-ink-500">{hint}</span>}
    </span>
    <span className="relative inline-flex shrink-0 items-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-6 w-11 rounded-full bg-white/[0.08] transition-colors duration-200 peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-900" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-premium peer-checked:translate-x-5" />
    </span>
  </label>
)

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, user, onUserChanged, onDataChanged, onPasswordChanged, onAccountDeleted }) => {
  const { prefs, setPrefs } = useLocalPrefs()
  const [form, setForm] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Always start from the latest saved values when the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setForm(settings)
      setError(null)
    }
  }, [isOpen, settings])

  const setNumber = (key: NumericKey, raw: string) => setForm((f) => ({ ...f, [key]: raw === '' ? 0 : Number(raw) }))

  const validate = (): string | null => {
    for (const key of Object.keys(SETTINGS_LIMITS) as NumericKey[]) {
      const { min, max } = SETTINGS_LIMITS[key]
      const v = form[key]
      if (!Number.isInteger(v) || v < min || v > max) return `${labels[key]} must be between ${min} and ${max}.`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch {
      /* surfaced by caller */
    } finally {
      setSaving(false)
    }
  }

  const numberField = (key: NumericKey, suffix: string) => (
    <Field label={labels[key]}>
      {(id) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={SETTINGS_LIMITS[key].min}
            max={SETTINGS_LIMITS[key].max}
            value={form[key] || ''}
            onChange={(e) => setNumber(key, e.target.value)}
            className={`${inputClass} pr-12 font-mono tabular-nums`}
            required
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-500">{suffix}</span>
        </div>
      )}
    </Field>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      title="Settings"
      description="Timer, alerts, calendar, data and account."
      icon={<SlidersHorizontal className="h-5 w-5" />}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <h3 className="eyebrow">Intervals</h3>
        <div className="grid grid-cols-3 gap-3">
          {numberField('work_duration', 'min')}
          {numberField('short_break_duration', 'min')}
          {numberField('long_break_duration', 'min')}
        </div>
        {numberField('long_break_interval', 'cycles')}

        <h3 className="eyebrow pt-2">Sounds & alerts</h3>
        <div className="space-y-2.5">
          <Toggle checked={form.auto_start_breaks} onChange={(v) => setForm({ ...form, auto_start_breaks: v })} label="Auto-start next interval" hint="Breaks and focus sessions begin on their own." />
          <Toggle checked={form.sound_enabled} onChange={(v) => setForm({ ...form, sound_enabled: v })} label="Sound" hint="Chimes on completion and soft ticks on controls." />
          {supportsNotifications() && (
            <Toggle
              checked={prefs.notifications_enabled && permission() !== 'denied'}
              onChange={async (v) => {
                if (v && permission() === 'default') await requestPermission()
                setPrefs({ notifications_enabled: v && permission() === 'granted' })
              }}
              label="Desktop notifications"
              hint={permission() === 'denied' ? 'Blocked in your browser settings.' : 'Get alerted when a session ends, even in another tab.'}
            />
          )}
          <button
            type="button"
            onClick={() => audioService.playWorkCompleteChime()}
            className="focus-ring flex items-center gap-1.5 rounded-md text-[12px] font-medium text-brand-400 hover:text-brand-300"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            Preview chime
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] pt-5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="submit" loading={saving}>
            Save timer settings
          </Button>
        </div>
      </form>

      {user && (
        <div className="mt-6 space-y-6 border-t border-white/[0.06] pt-6">
          <CalendarSyncSection hasToken={Boolean(user.has_calendar_token)} onChanged={onUserChanged} />
          <ImportSection onImported={onDataChanged} />
          <AccountSection email={user.email} hasPassword={Boolean(user.has_password)} googleLinked={Boolean(user.google_linked)} onPasswordChanged={onPasswordChanged} onDeleted={onAccountDeleted} />
        </div>
      )}
    </Modal>
  )
}
