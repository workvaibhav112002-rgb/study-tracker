import { describe, expect, it } from 'vitest'
import { formatClock, formatMinutes, localDateAt, localDateString } from './time'

describe('time helpers', () => {
  it('formats clock and minutes', () => {
    expect(formatClock(1500)).toBe('25:00')
    expect(formatClock(59)).toBe('00:59')
    expect(formatMinutes(95)).toBe('1h 35m')
    expect(formatMinutes(40)).toBe('40m')
  })

  it('uses the local calendar day', () => {
    const d = new Date(2026, 9, 23, 23, 30)
    expect(localDateString(d)).toBe('2026-10-23')
    const noon = localDateAt('2026-10-23')
    expect(noon?.getHours()).toBe(12)
    expect(noon?.getDate()).toBe(23)
    expect(localDateAt('nope')).toBeNull()
  })
})
