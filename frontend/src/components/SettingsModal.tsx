import React, { useState } from 'react'
import { X, Settings as SettingsIcon, Volume2, Bell } from 'lucide-react'
import { Settings } from '../types'
import { audioService } from '../services/audio'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => Promise<void>
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [form, setForm] = useState<Settings>({ ...settings })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(form)
    onClose()
  }

  const handleTestSound = () => {
    audioService.playWorkCompleteChime()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-brand-400 flex items-center justify-center border border-slate-700">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Timer Preferences</h3>
            <p className="text-xs text-slate-400">Customize intervals, breaks, and notifications.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Durations Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Work (mins)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={form.work_duration}
                onChange={(e) =>
                  setForm({ ...form, work_duration: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Short Break
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={form.short_break_duration}
                onChange={(e) =>
                  setForm({ ...form, short_break_duration: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Long Break
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={form.long_break_duration}
                onChange={(e) =>
                  setForm({ ...form, long_break_duration: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
          </div>

          {/* Long Break Interval */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Long Break Interval (Pomodoro count)
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={form.long_break_interval}
              onChange={(e) =>
                setForm({ ...form, long_break_interval: Number(e.target.value) })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          {/* Toggles */}
          <div className="pt-2 space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_start_breaks}
                onChange={(e) =>
                  setForm({ ...form, auto_start_breaks: e.target.checked })
                }
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800 focus:ring-brand-500"
              />
              <span className="text-xs font-medium text-slate-300">
                Auto-start breaks & pomodoros
              </span>
            </label>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sound_enabled}
                  onChange={(e) =>
                    setForm({ ...form, sound_enabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800 focus:ring-brand-500"
                />
                <span className="text-xs font-medium text-slate-300">
                  Audio sound chimes
                </span>
              </label>

              <button
                type="button"
                onClick={handleTestSound}
                className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center space-x-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Chime</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-xs font-bold shadow-lg shadow-brand-500/20 transition-all"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
