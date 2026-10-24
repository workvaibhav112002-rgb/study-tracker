import type { Friend } from '../types'

export interface LeaderboardRow {
  id: number
  name: string
  handle: string | null
  week_minutes: number
  today_minutes: number
  current_streak_days: number
  studying: boolean
  me: boolean
  rank: number
}

/** Friends plus the signed-in user, ranked by minutes this week (ties share a rank). */
export function buildLeaderboard(friends: Friend[], me: { id: number; name: string; handle: string | null; week_minutes: number; today_minutes: number; current_streak_days: number }): LeaderboardRow[] {
  const rows = [
    { ...me, studying: false, me: true },
    ...friends.map((f) => ({ ...f, me: false })),
  ].sort((a, b) => b.week_minutes - a.week_minutes || b.today_minutes - a.today_minutes || a.name.localeCompare(b.name))
  let rank = 0
  let prev = -1
  return rows.map((r, i) => {
    if (r.week_minutes !== prev) {
      rank = i + 1
      prev = r.week_minutes
    }
    return { ...r, rank }
  })
}
