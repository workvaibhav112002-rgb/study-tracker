import { useCallback, useEffect, useRef } from 'react'

const PREFIX = 'study_tracker_draft_v1:'

/** Reads a saved draft, or null when missing, unreadable or malformed. */
export function readDraft<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const v = JSON.parse(raw) as unknown
    return isValid(v) ? v : null
  } catch {
    return null
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** Drops every draft (on sign-out, so nothing lingers for the next user). */
export function clearAllDrafts(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/**
 * Saves `value` under `key` shortly after it stops changing, while `enabled`.
 * Saving also happens on page hide so a closed tab keeps the latest text.
 */
export function useDraftAutosave(key: string, value: unknown, enabled: boolean, delayMs = 400): void {
  const latest = useRef(value)
  latest.current = value
  const save = useCallback(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(latest.current))
    } catch {
      /* quota or private mode: drafts are best effort */
    }
  }, [key])

  useEffect(() => {
    if (!enabled) return
    const t = window.setTimeout(save, delayMs)
    return () => window.clearTimeout(t)
  }, [value, enabled, delayMs, save])

  useEffect(() => {
    if (!enabled) return
    const onHide = () => save()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [enabled, save])
}
