import type { DashboardStats, GoalStreak, Project, WeeklyReview } from '../types'

/**
 * Bring-your-own-key study coach. The key lives only in this browser's
 * localStorage and is sent straight to Anthropic; it never touches the
 * Study Tracker API.
 */

const KEY = 'study_tracker_coach_key_v1'
export const COACH_MODEL = 'claude-opus-5-5'

export function getCoachKey(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function setCoachKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY, key)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}

export interface CoachContext {
  stats: DashboardStats
  review: WeeklyReview | null
  streak: GoalStreak | null
  projects: Project[]
  question: string
}

/** Compact, numeric summary so the model reasons over facts, not vibes. */
export function buildCoachPrompt(c: CoachContext): { system: string; user: string } {
  const lines: string[] = [
    `Today: ${c.stats.today_minutes} min. Last 7 days: ${c.stats.weekly_minutes} min. All time: ${c.stats.total_minutes} min.`,
    `Study streak: ${c.stats.current_streak_days} days. Completed pomodoros: ${c.stats.completed_pomodoros}. Avg interruptions per session: ${(c.stats.avg_interruptions ?? 0).toFixed(1)}.`,
  ]
  if (c.stats.week_over_week) lines.push(`Week over week: ${c.stats.week_over_week.this_week_minutes} vs ${c.stats.week_over_week.previous_week_minutes} min.`)
  if (c.streak) lines.push(`Daily goal: ${c.streak.target_minutes} min. Goal streak: ${c.streak.days} days (best ${c.streak.best_days}). Today met: ${c.streak.today_met}.`)
  if (c.review) {
    lines.push(`Last week: ${c.review.minutes} min over ${c.review.active_days} active days, ${c.review.sessions} sessions, avg focus rating ${c.review.avg_rating.toFixed(1)}/5.`)
    if (c.review.best_hour !== null && c.review.best_hour !== undefined) lines.push(`Most productive hour: ${c.review.best_hour}:00.`)
    if (c.review.top_project) lines.push(`Top project: ${c.review.top_project.name} (${Math.round(c.review.top_project_share * 100)}% of time).`)
  }
  if (c.projects.length > 0) {
    lines.push('Projects:')
    for (const p of c.projects) {
      const bits = [`${p.name}: ${p.total_minutes ?? 0} min total, target ${p.target_minutes_per_day} min/day`]
      if (p.planned_hours_per_week) bits.push(`planned ${p.planned_hours_per_week} h/week, this week ${Math.round((p.week_minutes ?? 0) / 60)} h`)
      if (p.exam_date) bits.push(`exam on ${p.exam_date}`)
      lines.push('- ' + bits.join('; '))
    }
  }
  const last14 = c.stats.daily_trend.map((d) => `${d.date}:${d.minutes}`).join(' ')
  lines.push(`Minutes per day, last 14 days: ${last14}`)

  return {
    system:
      'You are a concise, encouraging study coach inside a Pomodoro app. You get the learner\'s real statistics. ' +
      'Answer in plain Markdown with at most 180 words: one honest observation grounded in the numbers, then two or three specific, ' +
      'actionable suggestions (session length, scheduling, which project needs attention, when to rest). Do not invent data. ' +
      'If the data is thin, say so briefly and suggest how to get a useful baseline.',
    user: `${lines.join('\n')}\n\nQuestion: ${c.question.trim() || 'How am I doing, and what should I change this week?'}`,
  }
}

export interface CoachStream {
  text: string
  stop: 'end_turn' | 'max_tokens' | 'refusal' | 'other'
}

/**
 * Streams a reply straight from the browser. Loads the SDK on demand so
 * users who never open the coach do not download it.
 */
export async function askCoach(apiKey: string, prompt: { system: string; user: string }, onText: (soFar: string) => void, signal?: AbortSignal): Promise<CoachStream> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
  const stream = client.beta.messages.stream(
    {
      model: COACH_MODEL,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    },
    { signal },
  )
  let text = ''
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      text += event.delta.text
      onText(text)
    }
  }
  const final = await stream.finalMessage()
  const stop: CoachStream['stop'] = final.stop_reason === 'end_turn' || final.stop_reason === 'max_tokens' || final.stop_reason === 'refusal' ? final.stop_reason : 'other'
  return { text, stop }
}
