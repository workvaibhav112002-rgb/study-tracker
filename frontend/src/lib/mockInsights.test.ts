import { describe, expect, it } from 'vitest'
import type { Mistake, Mock } from '../types'
import { clearsTarget, cutoffTrajectory, marksLeakage, mistakesToCsv, patternMatrix, sectionForSubject, totalWastedMinutes } from './mockInsights'

const mock = (id: number, date: string, correct: number, incorrect: number): Mock => ({
  id, project_id: 1, name: `Mock ${id}`, provider: '', attempted_on: date, percentile: null, rank: null, notes: '',
  sections: [
    { name: 'Quantitative Aptitude', questions: 35, correct, incorrect, seconds: 1200, marks_each: 1, negative_each: 0.25 },
    { name: 'Reasoning', questions: 35, correct: 30, incorrect: 0, seconds: 1200, marks_each: 1, negative_each: 0.25 },
  ],
})

let nextId = 1
const mistake = (over: Partial<Mistake>): Mistake => ({
  id: nextId++, project_id: 1, mock_id: null, subject: 'Quant', pattern: 'DI', root_cause: 'procedural', question: '', rule: '', solution: '',
  actual_seconds: null, ideal_seconds: null, status: 'active', last_reviewed_at: null, created_at: '2026-10-01T10:00:00Z', ...over,
})

describe('cutoffTrajectory', () => {
  it('orders by date and averages the last 4 weeks', () => {
    const pts = cutoffTrajectory([mock(2, '2026-10-20', 30, 0), mock(1, '2026-09-01', 20, 4), mock(3, '2026-10-25', 20, 0)])
    expect(pts.map((p) => p.id)).toEqual([1, 2, 3])
    expect(pts[0]).toMatchObject({ net: 49, rolling: 49 })
    // Mock 1 is more than 28 days before mock 2, so it drops out.
    expect(pts[1].rolling).toBe(60)
    expect(pts[2].rolling).toBe(55)
    expect(clearsTarget(pts, 55)).toBe(true)
    expect(clearsTarget(pts, 56)).toBe(false)
    expect(clearsTarget(pts, 0)).toBeNull()
  })
})

describe('sectionForSubject', () => {
  it('matches short subject names to long section names', () => {
    const s = mock(1, '2026-10-01', 0, 0).sections
    expect(sectionForSubject(s, 'Quant')?.name).toBe('Quantitative Aptitude')
    expect(sectionForSubject(s, 'reasoning')?.name).toBe('Reasoning')
    expect(sectionForSubject(s, 'English')).toBeUndefined()
  })
})

describe('marksLeakage', () => {
  it('splits lost marks by root cause and computes the clean score', () => {
    const m = mock(1, '2026-10-01', 20, 4)
    const list = [
      mistake({ mock_id: 1, root_cause: 'procedural' }),
      mistake({ mock_id: 1, root_cause: 'procedural' }),
      mistake({ mock_id: 1, root_cause: 'time_ego', subject: 'Reasoning' }),
      mistake({ mock_id: 1, root_cause: 'concept' }),
      mistake({ mock_id: null, root_cause: 'procedural' }),
    ]
    const [p] = marksLeakage([m], list)
    expect(p).toMatchObject({ net: 49, silly: 2.5, ego: 1.25, concept: 1.25, clean: 52.75, maxMarks: 70 })
  })
})

describe('patternMatrix', () => {
  it('zones patterns by frequency and overtime', () => {
    const list = [
      ...[0, 1, 2].map(() => mistake({ pattern: 'Puzzle', subject: 'Reasoning', actual_seconds: 180, ideal_seconds: 60 })),
      ...[0, 1, 2].map(() => mistake({ pattern: 'Syllogism', subject: 'Reasoning', actual_seconds: 40, ideal_seconds: 45 })),
      mistake({ pattern: 'Series', actual_seconds: 90, ideal_seconds: 60 }),
      mistake({ pattern: 'RC', subject: 'English' }),
    ]
    const m = patternMatrix(list)
    expect(m.map((p) => [p.pattern, p.zone])).toEqual([
      ['Puzzle', 'red'],
      ['Syllogism', 'yellow'],
      ['Series', 'yellow'],
      ['RC', 'green'],
    ])
    expect(m[0]).toMatchObject({ count: 3, avgActual: 180, avgIdeal: 60, wastedSeconds: 360, subject: 'Reasoning' })
    expect(totalWastedMinutes(list)).toBe(7)
  })
})

describe('mistakesToCsv', () => {
  it('quotes and neutralises formulas', () => {
    const csv = mistakesToCsv([mistake({ question: '=SUM(A1)', rule: 'a, "b"' })], () => 'P', () => '')
    const line = csv.split('\r\n')[1]
    expect(line).toContain("'=SUM(A1)")
    expect(line).toContain('"a, ""b"""')
  })
})
