import { useSyncExternalStore } from 'react'
import { getPrefs, setPrefs, subscribePrefs, type LocalPrefs } from '../lib/prefs'

export function useLocalPrefs(): { prefs: LocalPrefs; setPrefs: (patch: Partial<LocalPrefs>) => void } {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs)
  return { prefs, setPrefs }
}
