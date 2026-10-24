import { describe, expect, it } from 'vitest'
import { dashOffset, goalFraction, ringGeometry } from './ring'

describe('ring', () => {
  it('computes geometry and offsets', () => {
    const g = ringGeometry(10, 2)
    expect(g.size).toBe(24)
    expect(dashOffset(g.circumference, 0)).toBeCloseTo(g.circumference)
    expect(dashOffset(g.circumference, 1)).toBeCloseTo(0)
    expect(dashOffset(g.circumference, 2)).toBeCloseTo(0)
  })
  it('clamps goal fraction', () => {
    expect(goalFraction(30, 60)).toBe(0.5)
    expect(goalFraction(90, 60)).toBe(1)
    expect(goalFraction(10, 0)).toBe(0)
  })
})
