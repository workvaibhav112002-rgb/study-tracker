import { describe, expect, it } from 'vitest'
import { buildHeatmap, levelFor, thresholdsFor } from './heatmap'

describe('heatmap', () => {
  it('lays out a Monday-start grid ending on the given day', () => {
    const end = new Date(2026, 9, 23) // Friday 23 Oct 2026
    const m = buildHeatmap([{ date: '2026-10-23', minutes: 50 }, { date: '2026-10-19', minutes: 10 }], end, 53)
    const last = m.cells[m.cells.length - 1]
    expect(last.date).toBe('2026-10-23')
    expect(last.row).toBe(4) // Friday
    expect(last.col).toBe(52)
    const monday = m.cells.find((c) => c.date === '2026-10-19')
    expect(monday?.row).toBe(0)
    expect(monday?.col).toBe(52)
    expect(m.cells[0].row).toBe(0)
    expect(m.cells.length).toBe(52 * 7 + 5)
    expect(m.monthLabels.some((l) => l.label === 'Oct')).toBe(true)
  })

  it('assigns levels by quantile and zero for empty days', () => {
    const t = thresholdsFor([0, 10, 20, 30, 40, 50])
    expect(levelFor(0, t)).toBe(0)
    expect(levelFor(5, t)).toBe(1)
    expect(levelFor(50, t)).toBe(5)
    expect(thresholdsFor([])).toEqual([1, 2, 3, 4])
    const empty = buildHeatmap([], new Date(2026, 0, 1), 4)
    expect(empty.cells.every((c) => c.level === 0)).toBe(true)
  })
})
