import type { DemoSession } from './demoTimer'

/** Tab-scoped hand-off of a landing-page session into a brand-new account. */
const KEY = 'study_tracker_demo_session_v1'

export function savePendingDemo(session: DemoSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    /* storage unavailable; the session is simply not saved */
  }
}

export function readPendingDemo(): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<DemoSession>
    if (typeof v.startedAt !== 'string' || typeof v.endedAt !== 'string' || typeof v.elapsedSeconds !== 'number') return null
    if (Number.isNaN(Date.parse(v.startedAt)) || Number.isNaN(Date.parse(v.endedAt)) || v.elapsedSeconds <= 0) return null
    return { startedAt: v.startedAt, endedAt: v.endedAt, elapsedSeconds: Math.round(v.elapsedSeconds) }
  } catch {
    return null
  }
}

export function clearPendingDemo(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
