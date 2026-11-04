import React, { useEffect, useState } from 'react'
import { SlidersHorizontal, Volume2 } from 'lucide-react'
import { SETTINGS_LIMITS, type AuthResponse, type Settings, type User } from '../types'
import { TEMPLATES, matchingTemplate } from '../lib/templates'
import { useLocalPrefs } from '../hooks/useLocalPrefs'
import { permission, requestPermission, supportsNotifications } from '../lib/notify'
import { CalendarSyncSection } from './settings/CalendarSyncSection'
import { ImportSection } from './settings/ImportSection'
import { AccountSection } from './settings/AccountSection'
import { AppearanceSection } from './settings/AppearanceSection'
import { RemindersSection } from './settings/RemindersSection'
import { ProfileSection } from './settings/ProfileSection'
import { audioService, canVibrate } from '../services/audio'
import { SOUNDS, type SoundId } from '../lib/sounds'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { isNativeApp } from '../lib/native'

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
  vapidPublicKey?: string
  appUrl?: string
}

type NumericKey = keyof typeof SETTINGS_LIMITS

const labels: Record<NumericKey, string> = {
  work_duration: 'Focus',
  short_break_duration: 'Short break',
  long_break_duration: 'Long break',
  long_break_interval: 'Pomodoros before a long break',
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] px-4 py-3 transition-colors hover:bg-fg/[0.05]">
    <span>
      <span className="block text-[13px] font-medium text-ink-100">{label}</span>
      {hint && <span className="block text-[11px] text-ink-500">{hint}</span>}
    </span>
    <span className="relative inline-flex shrink-0 items-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-6 w-11 rounded-full bg-fg/[0.08] transition-colors duration-200 peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-900" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-premium peer-checked:translate-x-5" />
    </span>
  </label>
)

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, user, onUserChanged, onDataChanged, onPasswordChanged, onAccountDeleted, vapidPublicKey = '', appUrl = '' }) => {
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
      description="Timer, alerts, reminders, add-ons, calendar, data and account."
      icon={<SlidersHorizontal className="h-5 w-5" />}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <h3 className="eyebrow">Intervals</h3>
        <div role="group" aria-label="Session templates" className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => {
            const on = matchingTemplate(form) === t.id
            return (
              <button key={t.id} type="button" aria-pressed={on} title={t.hint} onClick={() => setForm({ ...form, ...t.values })} className={`focus-ring chip transition ${on ? 'border-brand-500/30 bg-brand-500/15 text-brand-300' : 'border-fg/[0.06] bg-fg/[0.04] text-ink-400 hover:text-ink-100'}`}>
                {t.name}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {numberField('work_duration', 'min')}
          {numberField('short_break_duration', 'min')}
          {numberField('long_break_duration', 'min')}
        </div>
        {numberField('long_break_interval', 'cycles')}

        <h3 className="eyebrow pt-2">Sounds & alerts</h3>
        <div className="space-y-2.5">
          <Toggle checked={form.auto_start_breaks} onChange={(v) => setForm({ ...form, auto_start_breaks: v })} label="Auto-start next interval" hint="Breaks and focus sessions begin on their own." />
          <Toggle checked={prefs.rate_each_session} onChange={(v) => setPrefs({ rate_each_session: v })} label="Ask me to rate each session" hint="Off: sessions save automatically and a small card lets you rate them. On: a rating dialog opens after every focus session. Saved on this device." />
          <Toggle checked={form.sound_enabled} onChange={(v) => setForm({ ...form, sound_enabled: v })} label="Sound" hint="Plays a sound when an interval ends, and soft ticks on controls." />
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
          {form.sound_enabled && (
            <div className="space-y-3 rounded-2xl border border-fg/[0.06] bg-fg/[0.02] p-4" role="group" aria-label="Sound choices">
              <p className="text-[11px] text-ink-500">Saved on this device right away.</p>
              {([['focus_sound', 'When a focus session ends'], ['break_sound', 'When a break ends']] as const).map(([key, label]) => (
                <div key={key} className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`sound-${key}`} className="min-w-[11rem] flex-1 text-[13px] text-ink-200">{label}</label>
                  <div className="flex items-center gap-1">
                  <select id={`sound-${key}`} className={`${inputClass} h-9 w-40 py-0 text-[13px]`} value={prefs[key]} onChange={(e) => { const id = e.target.value as SoundId; setPrefs({ [key]: id }); audioService.play(id, prefs.volume, prefs.gentle_sound) }}>
                    {SOUNDS.map((snd) => <option key={snd.id} value={snd.id}>{snd.label}</option>)}
                  </select>
                  <button type="button" aria-label={`Preview: ${label.toLowerCase()}`} onClick={() => audioService.play(prefs[key], prefs.volume, prefs.gentle_sound)} title="Preview" className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-brand-400 hover:bg-fg/[0.06] hover:text-brand-300">
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="sound-volume" className="min-w-[11rem] flex-1 text-[13px] text-ink-200">Volume</label>
                <input id="sound-volume" type="range" min={0} max={100} step={5} value={Math.round(prefs.volume * 100)} onChange={(e) => setPrefs({ volume: Number(e.target.value) / 100 })} onPointerUp={() => audioService.play(prefs.focus_sound, prefs.volume, false)} onKeyUp={(e) => { if (e.key.startsWith('Arrow')) audioService.play(prefs.focus_sound, prefs.volume, false) }} className="w-40 accent-brand-500" aria-valuetext={`${Math.round(prefs.volume * 100)} percent`} />
                <span className="w-10 text-right font-mono text-[12px] tabular-nums text-ink-300">{Math.round(prefs.volume * 100)}%</span>
              </div>
              <Toggle checked={prefs.gentle_sound} onChange={(v) => setPrefs({ gentle_sound: v })} label="Gentle mode" hint="Plays the sound three times, from quiet to full, instead of all at once. Nicer with headphones." />
              <Toggle
                checked={prefs.vibrate}
                onChange={(v) => { setPrefs({ vibrate: v }); if (v) audioService.vibrate('focus') }}
                label="Vibrate"
                hint={canVibrate() ? 'Buzz the phone when an interval ends.' : 'Works on Android phones. This browser cannot vibrate.'}
              />
            </div>
          )}
        </div>

        {user && !isNativeApp() && <RemindersSection form={form} setForm={setForm} vapidPublicKey={vapidPublicKey} Toggle={Toggle} />}

        {user && (
          <>
            <h3 className="eyebrow pt-2">Add-ons</h3>
            <div className="space-y-2.5">
              <Toggle checked={form.cards_enabled} onChange={(v) => setForm({ ...form, cards_enabled: v })} label="Flashcards" hint="Spaced-repetition cards for anything you want to remember. Adds a Cards tab." />
              <Toggle checked={form.mistake_lab_enabled} onChange={(v) => setForm({ ...form, mistake_lab_enabled: v })} label="Mistake Lab" hint="Log slips and mistakes with your own categories and see the ones you keep repeating. On by default." />
              <p className="text-[11px] text-ink-500">Turning an add-on off only hides it. Everything you saved comes back when you turn it on again.</p>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-fg/[0.06] pt-5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="submit" loading={saving}>
            Save settings
          </Button>
        </div>
      </form>

      {user && (
        <div className="mt-6 space-y-6 border-t border-fg/[0.06] pt-6">
          <AppearanceSection />
          <ProfileSection user={user} appUrl={appUrl} onChanged={onUserChanged} />
          <CalendarSyncSection hasToken={Boolean(user.has_calendar_token)} onChanged={onUserChanged} />
          <ImportSection onImported={onDataChanged} />
          <AccountSection email={user.email} hasPassword={Boolean(user.has_password)} googleLinked={Boolean(user.google_linked)} onPasswordChanged={onPasswordChanged} onDeleted={onAccountDeleted} />
        </div>
      )}
    </Modal>
  )
}
