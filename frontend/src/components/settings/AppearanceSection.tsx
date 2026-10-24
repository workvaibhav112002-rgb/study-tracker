import React from 'react'
import { Moon, Sun, MonitorSmartphone, Check } from 'lucide-react'
import { useLocalPrefs } from '../../hooks/useLocalPrefs'
import type { Accent, Theme } from '../../lib/prefs'

const THEMES: { id: Theme; label: string; icon: React.ElementType }[] = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: MonitorSmartphone },
]
const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9' },
  { id: 'violet', label: 'Violet', swatch: '#8b5cf6' },
  { id: 'amber', label: 'Amber', swatch: '#f59e0b' },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e' },
]

export const AppearanceSection: React.FC = () => {
  const { prefs, setPrefs } = useLocalPrefs()
  return (
    <section aria-labelledby="appearance-section" className="space-y-3">
      <div>
        <h3 id="appearance-section" className="eyebrow">Appearance</h3>
        <p className="mt-1 text-xs text-ink-500">Saved on this device.</p>
      </div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const Icon = t.icon
          const on = prefs.theme === t.id
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setPrefs({ theme: t.id })} className={`focus-ring flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition ${on ? 'border-brand-500/40 bg-brand-500/10 text-ink-50 shadow-inner-hi' : 'border-fg/[0.06] bg-fg/[0.03] text-ink-400 hover:text-ink-100'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap items-center gap-2.5">
        {ACCENTS.map((a) => {
          const on = prefs.accent === a.id
          return (
            <button key={a.id} type="button" role="radio" aria-checked={on} aria-label={a.label} title={a.label} onClick={() => setPrefs({ accent: a.id })} className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full transition-all ${on ? 'scale-110 ring-2 ring-ink-50 ring-offset-2 ring-offset-surface-900' : 'hover:scale-110'}`} style={{ backgroundColor: a.swatch, boxShadow: on ? `0 0 16px ${a.swatch}` : undefined }}>
              {on && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
