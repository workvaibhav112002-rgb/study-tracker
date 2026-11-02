import type { JournalCategory, JournalConfig, Mistake, PatternAlert } from '../types'
import { categoryOf, optionColor, optionLabel, tagValues } from './journal'

const DAY = 86_400_000
const t = (m: Mistake) => Date.parse(m.created_at)

/** Mirror of detectPatterns in backend/internal/httpapi/journal.go. */
export function detectPatterns(projectId: number, mistakes: Mistake[], cfg: JournalConfig, now = Date.now()): PatternAlert[] {
  const since = now - cfg.patterns.window_days * DAY
  const inWindow = mistakes.filter((m) => t(m) >= since)
  const out: PatternAlert[] = []
  for (const combo of cfg.patterns.watch) {
    const groups = new Map<string, PatternAlert>()
    for (const m of inWindow) {
      let keys: string[][] = [[]]
      for (const cat of combo) {
        const vals = tagValues(m, cat)
        if (vals.length === 0) {
          keys = []
          break
        }
        keys = keys.flatMap((k) => vals.map((v) => [...k, v]))
      }
      for (const vals of keys) {
        const id = vals.join('\u0000')
        const g = groups.get(id) ?? { project_id: projectId, categories: [...combo], values: vals, count: 0, last_at: m.created_at, mistake_ids: [] }
        g.count++
        g.mistake_ids.push(m.id)
        if (m.created_at > g.last_at) g.last_at = m.created_at
        groups.set(id, g)
      }
    }
    for (const g of groups.values()) if (g.count >= cfg.patterns.threshold) out.push(g)
  }
  return out.sort((a, b) => b.count - a.count || b.categories.length - a.categories.length || b.last_at.localeCompare(a.last_at))
}

/** "Fractions · Careless slip" for an alert. */
export function describeAlert(cfg: JournalConfig, a: Pick<PatternAlert, 'categories' | 'values'>): string {
  return a.categories.map((c, i) => optionLabel(categoryOf(cfg, c), a.values[i])).join(' · ')
}

/** Monday of the week containing `ms`, as YYYY-MM-DD in local time. */
export function weekStart(ms: number): string {
  const d = new Date(ms)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface WeekRow {
  week: string
  total: number
  /** Counts per option key of the stacking category (plus "__none"). */
  [key: string]: number | string
}

/** Weekly counts for the last `weeks` weeks, split by one category. */
export function weeklySeries(mistakes: Mistake[], stackBy: string, weeks: number, now = Date.now()): WeekRow[] {
  const rows: WeekRow[] = []
  const index = new Map<string, WeekRow>()
  for (let i = weeks - 1; i >= 0; i--) {
    const w = weekStart(now - i * 7 * DAY)
    if (index.has(w)) continue
    const row: WeekRow = { week: w, total: 0 }
    rows.push(row)
    index.set(w, row)
  }
  for (const m of mistakes) {
    const row = index.get(weekStart(t(m)))
    if (!row) continue
    row.total++
    const vals = tagValues(m, stackBy)
    const key = vals[0] ?? '__none'
    row[key] = ((row[key] as number | undefined) ?? 0) + 1
  }
  return rows
}

export interface Slice {
  value: string
  label: string
  color: string
  count: number
}

/** Counts per value of a category, biggest first. */
export function breakdown(mistakes: Mistake[], cat: JournalCategory | undefined, limit = 10): Slice[] {
  if (!cat) return []
  const counts = new Map<string, number>()
  for (const m of mistakes) for (const v of tagValues(m, cat.key)) counts.set(v, (counts.get(v) ?? 0) + 1)
  const rows = [...counts.entries()].map(([value, count]) => ({ value, count, label: optionLabel(cat, value), color: optionColor(cat, value) }))
  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  if (rows.length <= limit) return rows
  const rest = rows.slice(limit - 1).reduce((a, r) => a + r.count, 0)
  return [...rows.slice(0, limit - 1), { value: '__other', label: 'Everything else', color: '#8b8f99', count: rest }]
}

export interface Matrix {
  rows: { value: string; label: string }[]
  cols: { value: string; label: string; color: string }[]
  cells: Record<string, Record<string, number>>
  max: number
}

/** Cross-count of two categories, e.g. Topic x Mistake type. */
export function matrix(mistakes: Mistake[], rowCat: JournalCategory | undefined, colCat: JournalCategory | undefined, rowLimit = 12): Matrix {
  const empty: Matrix = { rows: [], cols: [], cells: {}, max: 0 }
  if (!rowCat || !colCat || rowCat.key === colCat.key) return empty
  const cells: Matrix['cells'] = {}
  const rowTotals = new Map<string, number>()
  const colTotals = new Map<string, number>()
  for (const m of mistakes) {
    for (const r of tagValues(m, rowCat.key)) {
      for (const c of tagValues(m, colCat.key)) {
        cells[r] ??= {}
        cells[r][c] = (cells[r][c] ?? 0) + 1
        rowTotals.set(r, (rowTotals.get(r) ?? 0) + 1)
        colTotals.set(c, (colTotals.get(c) ?? 0) + 1)
      }
    }
  }
  const rows = [...rowTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, rowLimit).map(([value]) => ({ value, label: optionLabel(rowCat, value) }))
  const order = (v: string) => {
    const i = colCat.options.findIndex((o) => o.key === v)
    return i < 0 ? 1000 : i
  }
  const cols = [...colTotals.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map((value) => ({ value, label: optionLabel(colCat, value), color: optionColor(colCat, value) }))
  let max = 0
  for (const r of rows) for (const c of cols) max = Math.max(max, cells[r.value]?.[c.value] ?? 0)
  return { rows, cols, cells, max }
}

export interface LagRow {
  value: string
  label: string
  score: number
  recent: number
  previous: number
  total: number
  unlearned: number
  repeating: boolean
  overtimeSeconds: number
  topCause: string | null
  reason: string
}

/**
 * Ranks values of a category by how much attention they need: mistakes in
 * the last 14 days count double, an active repeat adds 3, every mistake not
 * yet locked in adds 1, and each full minute over the expected time adds 0.5.
 */
export function lagScores(mistakes: Mistake[], cfg: JournalConfig, catKey: string, now = Date.now()): LagRow[] {
  const cat = categoryOf(cfg, catKey)
  const causeCat = categoryOf(cfg, 'mistake_type')
  const alerts = detectPatterns(0, mistakes, cfg, now)
  const repeatingValues = new Set(alerts.filter((a) => a.categories.includes(catKey)).map((a) => a.values[a.categories.indexOf(catKey)]))
  const groups = new Map<string, Mistake[]>()
  for (const m of mistakes) for (const v of tagValues(m, catKey)) groups.set(v, [...(groups.get(v) ?? []), m])
  const rows: LagRow[] = []
  for (const [value, list] of groups) {
    const recent = list.filter((m) => now - t(m) < 14 * DAY).length
    const previous = list.filter((m) => now - t(m) >= 14 * DAY && now - t(m) < 28 * DAY).length
    const unlearned = list.filter((m) => m.status !== 'locked_in').length
    const overtimeSeconds = list.reduce((a, m) => a + (m.actual_seconds !== null && m.ideal_seconds !== null ? Math.max(0, m.actual_seconds - m.ideal_seconds) : 0), 0)
    const causes = new Map<string, number>()
    for (const m of list) for (const c of tagValues(m, 'mistake_type')) causes.set(c, (causes.get(c) ?? 0) + 1)
    const top = [...causes.entries()].sort((a, b) => b[1] - a[1])[0]
    const repeating = repeatingValues.has(value)
    const score = recent * 2 + (list.length - recent) * 0.5 + (repeating ? 3 : 0) + unlearned + Math.floor(overtimeSeconds / 60) * 0.5
    const parts = [
      recent > 0 ? `${recent} in the last 2 weeks` : `${list.length} logged`,
      top && top[1] > 1 && causeCat && catKey !== 'mistake_type' ? `${top[1]}× ${optionLabel(causeCat, top[0]).toLowerCase()}` : '',
      unlearned === list.length ? 'none locked in yet' : `${list.length - unlearned} of ${list.length} locked in`,
      overtimeSeconds >= 60 ? `${Math.round(overtimeSeconds / 60)} min over time` : '',
    ].filter(Boolean)
    rows.push({ value, label: optionLabel(cat, value), score, recent, previous, total: list.length, unlearned, repeating, overtimeSeconds, topCause: top ? top[0] : null, reason: parts.join(', ') })
  }
  return rows.filter((r) => r.unlearned > 0).sort((a, b) => b.score - a.score || b.recent - a.recent || a.label.localeCompare(b.label))
}

export interface Trend {
  value: string
  label: string
  recent: number
  previous: number
  change: number
}

/** Values whose count rose or fell most between the previous and last 14 days. */
export function trends(mistakes: Mistake[], cat: JournalCategory | undefined, now = Date.now()): { worse: Trend[]; better: Trend[] } {
  if (!cat) return { worse: [], better: [] }
  const map = new Map<string, Trend>()
  for (const m of mistakes) {
    const age = now - t(m)
    if (age >= 28 * DAY) continue
    for (const v of tagValues(m, cat.key)) {
      const row = map.get(v) ?? { value: v, label: optionLabel(cat, v), recent: 0, previous: 0, change: 0 }
      if (age < 14 * DAY) row.recent++
      else row.previous++
      row.change = row.recent - row.previous
      map.set(v, row)
    }
  }
  const all = [...map.values()]
  return {
    worse: all.filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, 3),
    better: all.filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, 3),
  }
}

export interface Kpis {
  thisWeek: number
  lastWeek: number
  lockedShare: number
  total: number
}

export function kpis(mistakes: Mistake[], now = Date.now()): Kpis {
  const thisWeekStart = Date.parse(`${weekStart(now)}T00:00:00`)
  const lastWeekStart = thisWeekStart - 7 * DAY
  const thisWeek = mistakes.filter((m) => t(m) >= thisWeekStart).length
  const lastWeek = mistakes.filter((m) => t(m) >= lastWeekStart && t(m) < thisWeekStart).length
  const locked = mistakes.filter((m) => m.status === 'locked_in').length
  return { thisWeek, lastWeek, lockedShare: mistakes.length ? Math.round((locked / mistakes.length) * 100) : 0, total: mistakes.length }
}

/** Cumulative logged vs locked in, per week. Locked-in time is the last review. */
export function masterySeries(mistakes: Mistake[], weeks: number, now = Date.now()): { week: string; logged: number; locked: number }[] {
  const starts: string[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const w = weekStart(now - i * 7 * DAY)
    if (!starts.includes(w)) starts.push(w)
  }
  return starts.map((w) => {
    const end = Date.parse(`${w}T00:00:00`) + 7 * DAY
    return {
      week: w,
      logged: mistakes.filter((m) => t(m) < end).length,
      locked: mistakes.filter((m) => m.status === 'locked_in' && m.last_reviewed_at && Date.parse(m.last_reviewed_at) < end).length,
    }
  })
}
