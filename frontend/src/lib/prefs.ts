/** Per-device preferences that never need to reach the server. */
export interface LocalPrefs {
  notifications_enabled: boolean
}

const KEY = 'study_tracker_prefs_v1'
const DEFAULTS: LocalPrefs = { notifications_enabled: false }
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
