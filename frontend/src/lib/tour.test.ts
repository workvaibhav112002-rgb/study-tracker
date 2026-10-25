import { describe, expect, it } from 'vitest'
import { EXAMPLE_DAYS, TOUR_STEPS, TOUR_TOTAL_MS, countUp, heatmapRevealCount, stepAt } from './tour'

describe('tour', () => {
  it('maps elapsed time to steps and wraps', () => {
    expect(stepAt(0)).toEqual({ index: 0, progress: 0 })
    expect(stepAt(TOUR_STEPS[0].durationMs + 1750).index).toBe(1)
    expect(stepAt(TOUR_STEPS[0].durationMs + 1750).progress).toBeCloseTo(0.5)
    expect(stepAt(TOUR_TOTAL_MS + 100)).toEqual({ index: 0, progress: 100 / TOUR_STEPS[0].durationMs })
    expect(stepAt(-100).index).toBe(TOUR_STEPS.length - 1)
  })
  it('eases monotonically and lands on the target', () => {
    const vals = [0, 0.25, 0.5, 0.75, 1].map((p) => countUp(p, 12))
    expect(vals[0]).toBe(0)
    expect(vals[4]).toBe(12)
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1])
    expect(heatmapRevealCount(1, 120)).toBe(120)
    expect(heatmapRevealCount(0, 120)).toBe(0)
  })
  it('ships deterministic example data', () => {
    expect(EXAMPLE_DAYS).toHaveLength(120)
    expect(EXAMPLE_DAYS[119].date).toBe('2026-06-30')
    expect(EXAMPLE_DAYS.some((d) => d.minutes === 0)).toBe(true)
  })
})
