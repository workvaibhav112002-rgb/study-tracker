import type { ExamTemplate, Mistake, Mock, MockSection } from '../types'
import { scoreMock } from './scoring'

const DAY_MS = 86_400_000
const round2 = (v: number) => Math.round(v * 100) / 100

export interface TrajectoryPoint {
  id: number
  date: string
  name: string
  net: number
  /** Mean net score of mocks in the 28 days up to and including this one. */
  rolling: number
}

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`)

/** Mocks in date order with a 4-week rolling average. */
export function cutoffTrajectory(mocks: Mock[], template?: ExamTemplate | null): TrajectoryPoint[] {
  const sorted = [...mocks].sort((a, b) => a.attempted_on.localeCompare(b.attempted_on) || a.id - b.id)
  const scored = sorted.map((m) => ({ m, net: scoreMock(m, template).net }))
  return scored.map(({ m, net }, i) => {
    const end = dayMs(m.attempted_on)
    const window = scored.slice(0, i + 1).filter((x) => end - dayMs(x.m.attempted_on) < 28 * DAY_MS)
    const rolling = window.reduce((a, x) => a + x.net, 0) / window.length
    return { id: m.id, date: m.attempted_on, name: m.name, net, rolling: round2(rolling) }
  })
}

/** Whether the latest rolling average clears the target. */
export function clearsTarget(points: TrajectoryPoint[], target: number): boolean | null {
  if (!points.length || target <= 0) return null
  return points[points.length - 1].rolling >= target
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/** The mock section a mistake's subject belongs to, matched loosely ("Quant" ~ "Quantitative Aptitude"). */
export function sectionForSubject(sections: MockSection[], subject: string): MockSection | undefined {
  const s = norm(subject)
  if (!s) return undefined
  return sections.find((x) => norm(x.name) === s) ?? sections.find((x) => norm(x.name).startsWith(s) || s.startsWith(norm(x.name)))
}

export interface LeakagePoint {
  id: number
  name: string
  date: string
  net: number
  silly: number
  ego: number
  concept: number
  /** Net score had the calculation and ego/time mistakes not happened. */
  clean: number
  maxMarks: number
}

/**
 * Marks lost per mock by root cause. Each logged mistake is assumed to be a
 * wrong answer: it cost its marks plus the negative marking.
 */
export function marksLeakage(mocks: Mock[], mistakes: Mistake[], template?: ExamTemplate | null): LeakagePoint[] {
  const byMock = new Map<number, Mistake[]>()
  for (const m of mistakes) {
    if (m.mock_id === null) continue
    byMock.set(m.mock_id, [...(byMock.get(m.mock_id) ?? []), m])
  }
  return [...mocks]
    .sort((a, b) => a.attempted_on.localeCompare(b.attempted_on) || a.id - b.id)
    .map((mock) => {
      const score = scoreMock(mock, template)
      const lost = { concept: 0, procedural: 0, time_ego: 0 }
      for (const mk of byMock.get(mock.id) ?? []) {
        const sec = sectionForSubject(mock.sections, mk.subject) ?? mock.sections[0]
        if (!sec) continue
        lost[mk.root_cause] += sec.marks_each + sec.negative_each
      }
      const clean = Math.min(score.maxMarks, score.net + lost.procedural + lost.time_ego)
      return {
        id: mock.id,
        name: mock.name,
        date: mock.attempted_on,
        net: score.net,
        silly: round2(lost.procedural),
        ego: round2(lost.time_ego),
        concept: round2(lost.concept),
        clean: round2(clean),
        maxMarks: score.maxMarks,
      }
    })
}

export type Zone = 'green' | 'yellow' | 'red'

export interface PatternStat {
  pattern: string
  subject: string
  count: number
  avgActual: number | null
  avgIdeal: number | null
  wastedSeconds: number
  zone: Zone
}

/**
 * Patterns ranked by how often and how expensively they go wrong.
 *  - red: frequent (5+) or repeated (3+) and at least 1.5x over the ideal time: skip on the first pass
 *  - yellow: repeated, or slower than ideal: attempt on the second pass
 *  - green: rare and within time: first-pass anchors
 */
export function patternMatrix(mistakes: Mistake[]): PatternStat[] {
  const groups = new Map<string, Mistake[]>()
  for (const m of mistakes) groups.set(m.pattern, [...(groups.get(m.pattern) ?? []), m])
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const out: PatternStat[] = []
  for (const [pattern, list] of groups) {
    const actual = list.flatMap((m) => (m.actual_seconds === null ? [] : [m.actual_seconds]))
    const ideal = list.flatMap((m) => (m.ideal_seconds === null ? [] : [m.ideal_seconds]))
    const wasted = list.reduce((a, m) => a + (m.actual_seconds !== null && m.ideal_seconds !== null ? Math.max(0, m.actual_seconds - m.ideal_seconds) : 0), 0)
    const avgActual = avg(actual)
    const avgIdeal = avg(ideal)
    const slow = avgActual !== null && avgIdeal !== null && avgIdeal > 0 ? avgActual / avgIdeal : 1
    const count = list.length
    const zone: Zone = count >= 5 || (count >= 3 && slow >= 1.5) ? 'red' : count >= 3 || slow > 1 ? 'yellow' : 'green'
    const subjects = new Map<string, number>()
    list.forEach((m) => subjects.set(m.subject, (subjects.get(m.subject) ?? 0) + 1))
    const subject = [...subjects.entries()].sort((a, b) => b[1] - a[1])[0][0]
    out.push({ pattern, subject, count, avgActual, avgIdeal, wastedSeconds: wasted, zone })
  }
  const rank: Record<Zone, number> = { red: 0, yellow: 1, green: 2 }
  return out.sort((a, b) => rank[a.zone] - rank[b.zone] || b.count - a.count || b.wastedSeconds - a.wastedSeconds)
}

/** Minutes lost to slow questions across the given mistakes. */
export function totalWastedMinutes(mistakes: Mistake[]): number {
  return Math.round(patternMatrix(mistakes).reduce((a, p) => a + p.wastedSeconds, 0) / 60)
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV with the same columns as the Excel import template. */
export function mistakesToCsv(mistakes: Mistake[], projectName: (id: number) => string, mockName: (id: number | null) => string): string {
  const head = ['Date', 'Project', 'Mock', 'Subject', 'Pattern', 'Root cause', 'Question / trap', 'Execution rule', 'Solution', 'Actual seconds', 'Ideal seconds', 'Status']
  const rows = mistakes.map((m) => [
    m.created_at.slice(0, 10), projectName(m.project_id), mockName(m.mock_id), m.subject, m.pattern, m.root_cause,
    m.question, m.rule, m.solution, m.actual_seconds, m.ideal_seconds, m.status,
  ])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
