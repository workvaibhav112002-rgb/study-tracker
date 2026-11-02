import type { ExamTemplate, Mistake, Mock, MockSection } from '../types'
import { scoreMock } from './scoring'
import { tagValues } from './journal'

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
  maxMarks: number
  /** Marks lost per mistake-type option key. */
  lost: Record<string, number>
}

/**
 * Marks lost per test by mistake type. Each logged mistake is assumed to be a
 * wrong answer: it cost its marks plus the negative marking of the section
 * whose name matches one of the mistake's tags (else the first section).
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
      const lost: Record<string, number> = {}
      for (const mk of byMock.get(mock.id) ?? []) {
        const tagTexts = Object.values(mk.tags).flat()
        const sec = tagTexts.map((t) => sectionForSubject(mock.sections, t)).find(Boolean) ?? mock.sections[0]
        if (!sec) continue
        const kind = tagValues(mk, 'mistake_type')[0] ?? 'untagged'
        lost[kind] = round2((lost[kind] ?? 0) + sec.marks_each + sec.negative_each)
      }
      return { id: mock.id, name: mock.name, date: mock.attempted_on, net: score.net, maxMarks: score.maxMarks, lost }
    })
}
