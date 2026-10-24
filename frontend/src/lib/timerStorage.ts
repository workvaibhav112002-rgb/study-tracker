import { isTimerState, type TimerState } from './timer'

export const TIMER_KEY = 'study_tracker_timer_v1'

interface Envelope {
  v: 1
  userId: number | null
  state: TimerState
}

/** Reads the persisted timer for this user, or null when absent/invalid. */
export function loadTimer(userId: number | null): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as Partial<Envelope>
    if (env.v !== 1 || env.userId !== userId || !isTimerState(env.state)) return null
    return env.state
  } catch {
    return null
  }
}

export function saveTimer(userId: number | null, state: TimerState): void {
  try {
    const env: Envelope = { v: 1, userId, state }
    localStorage.setItem(TIMER_KEY, JSON.stringify(env))
  } catch {
    /* storage unavailable */
  }
}

export function clearTimer(): void {
  try {
    localStorage.removeItem(TIMER_KEY)
  } catch {
    /* ignore */
  }
}
