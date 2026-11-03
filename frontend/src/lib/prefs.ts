import type { SoundId } from './sounds'

/** Per-device preferences that never need to reach the server. */
export type Theme = 'dark' | 'light' | 'system'
export type Accent = 'emerald' | 'sky' | 'violet' | 'amber' | 'rose'

export interface LocalPrefs {
  notifications_enabled: boolean
  theme: Theme
  accent: Accent
  /** Sound at the end of a focus session and of a break. */
  focus_sound: SoundId
  break_sound: SoundId
  /** 0..1, applied on top of the device volume. */
  volume: number
  /** Vibrate on phones that support it. */
  vibrate: boolean
  /** Play the sound three times, quiet to full, instead of all at once. */
  gentle_sound: boolean
}

const KEY = 'study_tracker_prefs_v1'
const DEFAULTS: LocalPrefs = { notifications_enabled: false, theme: 'dark', accent: 'emerald', focus_sound: 'chime', break_sound: 'soft', volume: 0.8, vibrate: true, gentle_sound: false }
const listeners = new Set<() => void>()
let cached: LocalPrefs | null = null

export function getPrefs(): LocalPrefs {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(KEY)
    cached = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LocalPrefs>) } : { ...DEFAULTS }
  } catch {
    cached = { ...DEFAULTS }
  }
  return cached
}

export function setPrefs(patch: Partial<LocalPrefs>): LocalPrefs {
  cached = { ...getPrefs(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
  return cached
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const THEME_COLORS: Record<'dark' | 'light', string> = { dark: '#07080c', light: '#f6f7fa' }

/** Applies theme and accent to <html> and the browser chrome colour. */
export function applyAppearance(prefs: LocalPrefs): void {
  const root = document.documentElement
  const prefersLight = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches
  const resolved: 'dark' | 'light' = prefs.theme === 'system' ? (prefersLight ? 'light' : 'dark') : prefs.theme
  root.dataset.theme = resolved
  root.dataset.accent = prefs.accent
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}
