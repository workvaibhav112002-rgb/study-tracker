import { describe, expect, it } from 'vitest'
import type { Mistake } from '../types'
import { DEFAULT_JOURNAL } from './journal'
import { breakdown, describeAlert, detectPatterns, kpis, lagScores, masterySeries, matrix, trends, weekStart, weeklySeries } from './patterns'

const NOW = Date.parse('2026-11-04T12:00:00Z') // a Wednesday
const DAY = 86_400_000
let id = 1
const m = (topic: string, kind: string, daysAgo: number, over: Partial<Mistake> = {}): Mistake => ({
  id: id++, project_id: 1, mock_id: null, tags: { topic, mistake_type: kind }, extra: {}, question: '', rule: '', solution: '',
  actual_seconds: null, ideal_seconds: null, status: 'active', last_reviewed_at: null,
  created_at: new Date(NOW - daysAgo * DAY).toISOString(), ...over,
})

// Same cases as TestMistakePatterns in backend/internal/httpapi/mocks_test.go.
describe('detectPatterns', () => {
  it('needs the threshold inside the window, per combination', () => {
    const list = [m('Moles', 'careless', 1), m('Moles', 'careless', 13), m('Moles', 'careless', 15), m('Moles', 'didnt_know', 2)]
    expect(detectPatterns(1, list, DEFAULT_JOURNAL, NOW)).toEqual([])
    list.push(m('Bonds', 'careless', 3))
    let a = detectPatterns(1, list, DEFAULT_JOURNAL, NOW)
    expect(a.map((x) => [x.categories.join(','), x.values.join('|'), x.count])).toEqual([['mistake_type', 'careless', 3]])
    list.push(m('Moles', 'careless', 4))
    a = detectPatterns(1, list, DEFAULT_JOURNAL, NOW)
    expect(a.map((x) => [x.categories.join(','), x.values.join('|'), x.count])).toEqual([['mistake_type', 'careless', 4], ['topic,mistake_type', 'Moles|careless', 3]])
    expect(describeAlert(DEFAULT_JOURNAL, a[1])).toBe('Moles · Careless slip')
  })
  it('expands multi-select values', () => {
    const cfg = { ...DEFAULT_JOURNAL, patterns: { threshold: 2, window_days: 14, watch: [['chapter']] } }
    const list = [m('a', 'careless', 1, { tags: { chapter: ['1', '2'] } }), m('a', 'careless', 2, { tags: { chapter: ['2'] } })]
    expect(detectPatterns(1, list, cfg, NOW).map((x) => x.values[0])).toEqual(['2'])
  })
})

describe('dashboard maths', () => {
  const list = [
    m('Fractions', 'careless', 1, { actual_seconds: 200, ideal_seconds: 60 }),
    m('Fractions', 'careless', 2),
    m('Fractions', 'careless', 5),
    m('Fractions', 'didnt_know', 20),
    m('Algebra', 'didnt_know', 3, { status: 'locked_in', last_reviewed_at: new Date(NOW - DAY).toISOString() }),
    m('Algebra', 'misread', 16),
    m('Algebra', 'misread', 17),
    m('Geometry', 'time', 40),
  ]
  it('ranks topics to focus on with a reason', () => {
    const rows = lagScores(list, DEFAULT_JOURNAL, 'topic', NOW)
    expect(rows.map((r) => r.label)).toEqual(['Fractions', 'Algebra', 'Geometry'])
    expect(rows[0]).toMatchObject({ recent: 3, total: 4, repeating: true, overtimeSeconds: 140 })
    expect(rows[0].reason).toBe('3 in the last 2 weeks, 3× careless slip, none locked in yet, 2 min over time')
  })
  it('drops topics that are fully locked in', () => {
    const done = [m('Done', 'careless', 1, { status: 'locked_in' })]
    expect(lagScores(done, DEFAULT_JOURNAL, 'topic', NOW)).toEqual([])
  })
  it('builds weekly stacks, breakdowns, a matrix and trends', () => {
    expect(weekStart(NOW)).toBe('2026-11-02')
    const weeks = weeklySeries(list, 'mistake_type', 4, NOW)
    expect(weeks.map((w) => w.week)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
    expect(weeks[3]).toMatchObject({ total: 2, careless: 2 })
    const b = breakdown(list, DEFAULT_JOURNAL.categories[0], 2)
    expect(b.map((x) => [x.label, x.count])).toEqual([['Fractions', 4], ['Everything else', 4]])
    const mx = matrix(list, DEFAULT_JOURNAL.categories[0], DEFAULT_JOURNAL.categories[1])
    expect(mx.cols.map((c) => c.value)).toEqual(['didnt_know', 'careless', 'misread', 'time'])
    expect(mx.cells.Fractions.careless).toBe(3)
    expect(mx.max).toBe(3)
    const tr = trends(list, DEFAULT_JOURNAL.categories[0], NOW)
    expect(tr.worse.map((x) => x.label)).toEqual(['Fractions'])
    expect(tr.better.map((x) => x.label)).toEqual(['Algebra'])
  })
  it('counts KPIs and mastery', () => {
    expect(kpis(list, NOW)).toEqual({ thisWeek: 2, lastWeek: 2, lockedShare: 13, total: 8 })
    const ms = masterySeries(list, 2, NOW)
    expect(ms[1]).toEqual({ week: '2026-11-02', logged: 8, locked: 1 })
  })
})
