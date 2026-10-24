import { useEffect, useSyncExternalStore } from 'react'
import { applyAppearance, getPrefs, setPrefs, subscribePrefs, type LocalPrefs } from '../lib/prefs'

export function useLocalPrefs(): { prefs: LocalPrefs; setPrefs: (patch: Partial<LocalPrefs>) => void } {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs)
  return { prefs, setPrefs }
}

/** Keeps <html data-theme/data-accent> in sync with prefs and the OS setting. */
export function useAppearance(): void {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs)
  useEffect(() => {
    applyAppearance(prefs)
    if (prefs.theme !== 'system' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyAppearance(prefs)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs])
}
