import type { Session, Settings } from '../types'

export interface Suggestion {
  minutes: number
  reason: string
}

const MIN = 15
const MAX = 60

/**
 * Suggests a focus length from the last two weeks of pomodoros. Short,
 * interrupted sessions argue for a shorter interval; consistently full,
 * well-rated ones argue for a longer one. Returns null with too little data
 * or when the current setting already fits.
 */
export function suggestWorkDuration(sessions: Session[], settings: Settings, now = Date.now()): Suggestion | null {
  const since = now - 14 * 86400_000
  const recent = sessions.filter((s) => s.session_type === 'pomodoro' && new Date(s.start_time).getTime() >= since)
  if (recent.length < 6) return null
  const planned = settings.work_duration * 60
  const completion = recent.reduce((sum, s) => sum + Math.min(1, s.duration_seconds / planned), 0) / recent.length
  const interruptions = recent.reduce((sum, s) => sum + (s.interruptions ?? 0), 0) / recent.length
  const rating = recent.reduce((sum, s) => sum + (s.focus_rating || 3), 0) / recent.length
  const current = settings.work_duration

  if ((completion < 0.75 || interruptions >= 2) && current > MIN) {
    const target = Math.max(MIN, Math.round((current * 0.8) / 5) * 5)
    if (target < current) {
      const why = completion < 0.75 ? `you finish about ${Math.round(completion * 100)}% of each ${current}-minute block` : `you average ${interruptions.toFixed(1)} interruptions per session`
      return { minutes: target, reason: `Try ${target}-minute sessions: ${why}.` }
    }
  }
  if (completion >= 0.95 && interruptions <= 0.5 && rating >= 4 && current < MAX) {
    const target = Math.min(MAX, Math.round((current * 1.2) / 5) * 5)
    if (target > current) {
      return { minutes: target, reason: `You finish ${current}-minute blocks with high focus. Try ${target} minutes.` }
    }
  }
  return null
}
