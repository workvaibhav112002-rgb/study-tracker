import { describe, expect, it } from 'vitest'
import { buildLeaderboard } from './leaderboard'

describe('buildLeaderboard', () => {
  it('ranks by week minutes with shared ranks for ties and includes me', () => {
    const rows = buildLeaderboard(
      [
        { id: 2, name: 'Bea', handle: 'bea', studying: true, today_minutes: 10, week_minutes: 300, current_streak_days: 2 },
        { id: 3, name: 'Cal', handle: null, studying: false, today_minutes: 0, week_minutes: 120, current_streak_days: 0 },
      ],
      { id: 1, name: 'Me', handle: null, week_minutes: 120, today_minutes: 30, current_streak_days: 5 },
    )
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Bea', 1],
      ['Me', 2],
      ['Cal', 2],
    ])
    expect(rows.find((r) => r.me)?.id).toBe(1)
  })
})
