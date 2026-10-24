import { describe, expect, it } from 'vitest'
import { suggestWorkDuration } from './adaptive'
import { DEFAULT_SETTINGS, type Session } from '../types'

const now = Date.parse('2026-03-10T12:00:00Z')
const mk = (n: number, seconds: number, interruptions: number, rating: number): Session[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    project_id: 1,
    start_time: new Date(now - (i + 1) * 3600_000).toISOString(),
    end_time: new Date(now - (i + 1) * 3600_000 + seconds * 1000).toISOString(),
    duration_seconds: seconds,
    session_type: 'pomodoro',
    focus_rating: rating,
    notes: '',
    interruptions,
  }))

describe('suggestWorkDuration', () => {
  it('needs enough recent data', () => {
    expect(suggestWorkDuration(mk(3, 1500, 0, 5), DEFAULT_SETTINGS, now)).toBeNull()
  })
  it('suggests shorter blocks when sessions are cut short or interrupted', () => {
    const s = suggestWorkDuration(mk(8, 900, 0, 3), DEFAULT_SETTINGS, now)
    expect(s?.minutes).toBe(20)
    expect(s?.reason).toMatch(/60%/)
    const t = suggestWorkDuration(mk(8, 1500, 3, 3), DEFAULT_SETTINGS, now)
    expect(t?.minutes).toBe(20)
    expect(t?.reason).toMatch(/interruptions/)
  })
  it('suggests longer blocks after consistently full, focused sessions', () => {
    expect(suggestWorkDuration(mk(8, 1500, 0, 5), DEFAULT_SETTINGS, now)?.minutes).toBe(30)
  })
  it('stays quiet when the current length fits', () => {
    expect(suggestWorkDuration(mk(8, 1500, 1, 3), DEFAULT_SETTINGS, now)).toBeNull()
  })
  it('ignores old and non-pomodoro sessions', () => {
    const old = mk(8, 900, 0, 3).map((s) => ({ ...s, start_time: new Date(now - 30 * 86400_000).toISOString() }))
    expect(suggestWorkDuration(old, DEFAULT_SETTINGS, now)).toBeNull()
  })
})
