import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCoachPrompt, getCoachKey, looksLikeAnthropicKey, setCoachKey } from './coach'
import type { DashboardStats } from '../types'

const stats: DashboardStats = {
  today_minutes: 30,
  weekly_minutes: 200,
  total_minutes: 1000,
  current_streak_days: 3,
  completed_pomodoros: 40,
  avg_interruptions: 1.25,
  week_over_week: { this_week_minutes: 200, previous_week_minutes: 150, delta_minutes: 50, delta_percent: 33 },
  project_stats: [],
  daily_trend: [{ date: '2026-03-09', minutes: 50 }],
}

describe('coach', () => {
  afterEach(() => setCoachKey(''))

  it('builds a numeric prompt and a default question', () => {
    const p = buildCoachPrompt({ stats, review: null, streak: { days: 2, best_days: 4, target_minutes: 60, today_met: false, yesterday_met: true, day_before_met: true, freeze_available: true, freeze_days: [], missed_yesterday: '' }, projects: [{ id: 1, name: 'Maths', color: '#fff', description: '', target_minutes_per_day: 60, exam_date: '2026-06-01', planned_hours_per_week: 5, week_minutes: 120, total_minutes: 600 }], question: '' })
    expect(p.user).toContain('Today: 30 min')
    expect(p.user).toContain('Goal streak: 2 days (best 4)')
    expect(p.user).toContain('Maths: 600 min total')
    expect(p.user).toContain('exam on 2026-06-01')
    expect(p.user).toContain('2026-03-09:50')
    expect(p.user).toMatch(/Question: How am I doing/)
    expect(p.system).toMatch(/study coach/)
  })

  it('stores the key locally only and validates its shape', () => {
    expect(getCoachKey()).toBe('')
    setCoachKey('sk-ant-' + 'a'.repeat(30))
    expect(getCoachKey()).toMatch(/^sk-ant-/)
    expect(looksLikeAnthropicKey('sk-ant-' + 'a'.repeat(30))).toBe(true)
    expect(looksLikeAnthropicKey('nope')).toBe(false)
  })

  it('streams text deltas through the SDK', async () => {
    const events = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } },
    ]
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        for (const e of events) yield e
      },
      finalMessage: async () => ({ stop_reason: 'end_turn' }),
    }
    const streamFn = vi.fn(() => stream)
    vi.doMock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { stream: streamFn } } } }))
    const { askCoach } = await import('./coach')
    const seen: string[] = []
    const out = await askCoach('sk-ant-test', { system: 's', user: 'u' }, (t) => seen.push(t))
    expect(seen).toEqual(['Hel', 'Hello'])
    expect(out).toEqual({ text: 'Hello', stop: 'end_turn' })
    expect(streamFn).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-opus-5-5', fallbacks: 'default' }), expect.anything())
    vi.doUnmock('@anthropic-ai/sdk')
  })
})
