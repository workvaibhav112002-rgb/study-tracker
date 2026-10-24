import { describe, expect, it } from 'vitest'
import { daysUntil, planStatus } from './plan'

describe('plan helpers', () => {
  it('counts days to an exam', () => {
    const now = new Date(2026, 9, 24)
    expect(daysUntil('2026-10-31', now)).toBe(7)
    expect(daysUntil('2026-10-24', now)).toBe(0)
    expect(daysUntil('2026-10-20', now)).toBe(-4)
    expect(daysUntil(null, now)).toBeNull()
    expect(daysUntil('bad', now)).toBeNull()
  })
  it('classifies the week against the plan', () => {
    expect(planStatus(0, null).status).toBe('none')
    expect(planStatus(300, 6)).toEqual({ status: 'behind', percent: 83 })
    expect(planStatus(300, 5)).toEqual({ status: 'on-track', percent: 100 })
    expect(planStatus(120, 5).status).toBe('behind')
    expect(planStatus(400, 5).status).toBe('ahead')
  })
})
