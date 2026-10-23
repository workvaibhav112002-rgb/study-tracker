import React, { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Volume2 } from 'lucide-react'
import { SETTINGS_LIMITS, type Settings } from '../types'
import { audioService } from '../services/audio'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => Promise<void>
}

type NumericKey = keyof typeof SETTINGS_LIMITS

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
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
      if (!Number.isInteger(v) || v < min || v > max) {
        return `${labels[key]} must be between ${min} and ${max}.`
      }
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

  const labels: Record<NumericKey, string> = {
    work_duration: 'Work (mins)',
    short_break_duration: 'Short Break',
    long_break_duration: 'Long Break',
    long_break_interval: 'Long Break Interval (Pomodoro count)',
  }

  const numberField = (key: NumericKey, className?: string) => (
    <Field label={labels[key]} className={className}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={SETTINGS_LIMITS[key].min}
          max={SETTINGS_LIMITS[key].max}
          value={form[key] || ''}
          onChange={(e) => setNumber(key, e.target.value)}
          className={inputClass}
          required
        />
      )}
    </Field>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      title="Timer Preferences"
      description="Customize intervals, breaks, and notifications."
      icon={<SettingsIcon className="w-5 h-5" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {numberField('work_duration')}
          {numberField('short_break_duration')}
          {numberField('long_break_duration')}
        </div>
        {numberField('long_break_interval')}

        <div className="pt-2 space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.auto_start_breaks}
              onChange={(e) => setForm({ ...form, auto_start_breaks: e.target.checked })}
              className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800 focus:ring-brand-500"
            />
            <span className="text-xs font-medium text-slate-300">Auto-start breaks & pomodoros</span>
          </label>

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sound_enabled}
                onChange={(e) => setForm({ ...form, sound_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800 focus:ring-brand-500"
              />
              <span className="text-xs font-medium text-slate-300">Audio sound chimes</span>
            </label>
            <button
              type="button"
              onClick={() => audioService.playWorkCompleteChime()}
              className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
            >
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Test Chime</span>
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-400 font-medium">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Preferences
          </Button>
        </div>
      </form>
    </Modal>
  )
}
