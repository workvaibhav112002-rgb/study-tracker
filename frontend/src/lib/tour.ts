import type { DailyStat } from '../types'
import type { ShareCardData } from './shareCard'

/** Scripted product tour shown on the landing page. Pure data and math. */
export type TourStepID = 'timer' | 'heatmap' | 'streak' | 'badge' | 'share'

export interface TourStep {
  id: TourStepID
  title: string
  caption: string
  durationMs: number
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'timer', title: 'A timer that never forgets', caption: 'Close the laptop, switch tabs, come back: the countdown is still right.', durationMs: 3500 },
  { id: 'heatmap', title: 'Every day you showed up', caption: 'A year of study at a glance. Darker means more minutes.', durationMs: 3500 },
  { id: 'streak', title: 'Streaks that forgive', caption: 'Hit your daily goal to grow it. One freeze a week covers a bad day.', durationMs: 3500 },
  { id: 'badge', title: 'Milestones unlock', caption: 'Hours, pomodoros, cards and streaks each earn a badge.', durationMs: 3500 },
  { id: 'share', title: 'Share your week', caption: 'One tap makes a card of your numbers to post anywhere.', durationMs: 3500 },
]

export const TOUR_TOTAL_MS = TOUR_STEPS.reduce((s, x) => s + x.durationMs, 0)

/** Which step is showing after `elapsedMs`, and how far through it (0..1). Wraps. */
export function stepAt(elapsedMs: number): { index: number; progress: number } {
  let t = ((elapsedMs % TOUR_TOTAL_MS) + TOUR_TOTAL_MS) % TOUR_TOTAL_MS
  for (let i = 0; i < TOUR_STEPS.length; i++) {
    const d = TOUR_STEPS[i].durationMs
    if (t < d) return { index: i, progress: t / d }
    t -= d
  }
  return { index: TOUR_STEPS.length - 1, progress: 1 }
}

const easeOut = (p: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3)

/** How many heatmap cells to reveal at `progress`; reaches `total` at 1. */
export function heatmapRevealCount(progress: number, total: number): number {
  return Math.round(easeOut(progress) * total)
}

/** Eased integer count-up that lands exactly on `target`. */
export function countUp(progress: number, target: number): number {
  return Math.round(easeOut(progress) * target)
}

/** Deterministic sample: 120 days ending 2026-06-30 with a weekday rhythm. */
export const EXAMPLE_END = new Date(2026, 5, 30)
export const EXAMPLE_DAYS: DailyStat[] = Array.from({ length: 120 }, (_, i) => {
  const d = new Date(EXAMPLE_END)
  d.setDate(d.getDate() - (119 - i))
  const dow = d.getDay()
  const base = dow === 0 ? 0 : dow === 6 ? 25 : 45
  const wave = Math.round(30 * Math.abs(Math.sin(i / 9)))
  const minutes = i % 11 === 3 ? 0 : base + wave
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { date: iso, minutes }
})

export const EXAMPLE_SHARE: ShareCardData = {
  title: 'Example week',
  streakDays: 12,
  weekMinutes: 540,
  totalMinutes: 2400,
  pomodoros: 96,
  topProject: { name: 'Linear Algebra', color: '#8b7cf6' },
  appUrl: 'study-tracker-olive-nine.vercel.app',
}

export const EXAMPLE_STREAK_DAYS = 12
