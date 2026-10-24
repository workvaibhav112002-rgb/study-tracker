import { describe, expect, it } from 'vitest'
import { renderShareCard, shareDataFromStats } from './shareCard'

describe('shareCard', () => {
  it('derives card data from stats', () => {
    const d = shareDataFromStats({ today_minutes: 0, weekly_minutes: 125, total_minutes: 600, current_streak_days: 4, completed_pomodoros: 20, project_stats: [{ project_id: 1, name: 'Go', color: '#3987e5', total_seconds: 100, session_count: 1 }], daily_trend: [] }, 'https://x.app')
    expect(d.streakDays).toBe(4)
    expect(d.topProject?.name).toBe('Go')
  })
  it('reports failure without a 2D context (jsdom)', () => {
    const canvas = document.createElement('canvas')
    expect(renderShareCard(canvas, shareDataFromStats({ today_minutes: 0, weekly_minutes: 0, total_minutes: 0, current_streak_days: 0, completed_pomodoros: 0, project_stats: [], daily_trend: [] }, 'x'))).toBe(false)
  })
})
