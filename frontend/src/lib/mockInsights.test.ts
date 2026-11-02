import { describe, expect, it } from 'vitest'
import type { Mistake, Mock } from '../types'
import { clearsTarget, cutoffTrajectory, marksLeakage, sectionForSubject } from './mockInsights'

const mock = (id: number, date: string, correct: number, incorrect: number): Mock => ({
  id, project_id: 1, name: `Mock ${id}`, provider: '', attempted_on: date, percentile: null, rank: null, notes: '',
  sections: [
    { name: 'Quantitative Aptitude', questions: 35, correct, incorrect, seconds: 1200, marks_each: 1, negative_each: 0.25 },
    { name: 'Reasoning', questions: 35, correct: 30, incorrect: 0, seconds: 1200, marks_each: 1, negative_each: 0.25 },
  ],
})

let nextId = 1
const mistake = (over: Partial<Mistake>): Mistake => ({
  id: nextId++, project_id: 1, mock_id: null, tags: { subject: 'Quant', topic: 'DI', mistake_type: 'careless' }, extra: {}, question: '', rule: '', solution: '',
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
  it('sums marks lost per mistake type using the matching section', () => {
    const m = mock(1, '2026-10-01', 20, 4)
    const list = [
      mistake({ mock_id: 1 }),
      mistake({ mock_id: 1 }),
      mistake({ mock_id: 1, tags: { subject: 'Reasoning', mistake_type: 'time' } }),
      mistake({ mock_id: 1, tags: { mistake_type: 'didnt_know' } }),
      mistake({ mock_id: null }),
    ]
    const [p] = marksLeakage([m], list)
    expect(p).toMatchObject({ net: 49, maxMarks: 70, lost: { careless: 2.5, time: 1.25, didnt_know: 1.25 } })
  })
})
