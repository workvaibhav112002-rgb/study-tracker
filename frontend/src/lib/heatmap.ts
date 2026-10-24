import type { DailyStat } from '../types'

export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface HeatmapCell {
  date: string
  minutes: number
  col: number
  row: number
  level: HeatLevel
}

export interface HeatmapModel {
  cells: HeatmapCell[]
  monthLabels: { col: number; label: string }[]
  thresholds: number[]
  weeks: number
}

/** Sequential emerald ramp, validated for the dark surface (level 0 = empty). */
export const LEVEL_COLORS = ['rgba(255,255,255,0.04)', '#065f46', '#047857', '#10b981', '#6ee7b7', '#d1fae5']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function iso(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Quantile thresholds over non-zero days: level 1..5 cut at 20/40/60/80 %. */
export function thresholdsFor(minutes: number[]): number[] {
  const nz = minutes.filter((m) => m > 0).sort((a, b) => a - b)
  if (nz.length === 0) return [1, 2, 3, 4]
  const q = (p: number) => nz[Math.floor(p * (nz.length - 1))]
  return [q(0.2), q(0.4), q(0.6), q(0.8)]
}

export function levelFor(minutes: number, thresholds: number[]): HeatLevel {
  if (minutes <= 0) return 0
  let level = 1
  for (const t of thresholds) if (minutes > t) level++
  return Math.min(5, level) as HeatLevel
}

/**
 * Lays days out on a weeks × 7 grid ending on `end` (local). Week starts on
 * Monday. Days missing from `days` render as zero.
 */
export function buildHeatmap(days: DailyStat[], end: Date = new Date(), weeks = 53): HeatmapModel {
  const byDate = new Map(days.map((d) => [d.date, d.minutes]))
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const endRow = (endDay.getDay() + 6) % 7 // Monday = 0
  const total = (weeks - 1) * 7 + endRow + 1
  const start = new Date(endDay)
  start.setDate(endDay.getDate() - (total - 1))

  const thresholds = thresholdsFor(days.map((d) => d.minutes))
  const cells: HeatmapCell[] = []
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let i = 0; i < total; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const date = iso(d)
    const minutes = byDate.get(date) ?? 0
    const col = Math.floor(i / 7)
    const row = i % 7
    cells.push({ date, minutes, col, row, level: levelFor(minutes, thresholds) })
    if (d.getMonth() !== lastMonth && d.getDate() <= 7 && row === 0) {
      monthLabels.push({ col, label: MONTHS[d.getMonth()] })
      lastMonth = d.getMonth()
    } else if (d.getMonth() !== lastMonth && row === 0) {
      lastMonth = d.getMonth()
    }
  }
  return { cells, monthLabels, thresholds, weeks }
}

export function formatHeatDate(date: string): string {
  return parseLocal(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
