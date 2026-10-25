import { describe, expect, it } from 'vitest'
import { demoElapsedSeconds, demoProgress, demoReducer, demoSessionFrom, initialDemoState } from './demoTimer'

const T0 = Date.parse('2026-03-10T10:00:00Z')

describe('demoTimer', () => {
  it('starts, ticks, pauses and resumes with accumulated time', () => {
    let s = initialDemoState(5)
    expect(s.secondsLeft).toBe(300)
    s = demoReducer(s, { type: 'start', now: T0 })
    expect(s.status).toBe('running')
    expect(s.targetEndAt).toBe(T0 + 300_000)
    s = demoReducer(s, { type: 'tick', now: T0 + 61_500 })
    expect(s.secondsLeft).toBe(239)
    s = demoReducer(s, { type: 'pause', now: T0 + 62_000 })
    expect(s.status).toBe('paused')
    expect(s.secondsLeft).toBe(238)
    expect(demoElapsedSeconds(s, T0 + 999_999)).toBe(62)
    s = demoReducer(s, { type: 'start', now: T0 + 100_000 })
    expect(s.targetEndAt).toBe(T0 + 100_000 + 238_000)
    expect(demoElapsedSeconds(s, T0 + 110_000)).toBe(72)
    expect(demoProgress(s)).toBeCloseTo(62 / 300, 2)
  })

  it('finishes at the target time with ended-at equal to the target', () => {
    let s = demoReducer(initialDemoState(5), { type: 'start', now: T0 })
    s = demoReducer(s, { type: 'tick', now: T0 + 300_000 + 5_000 })
    expect(s.status).toBe('done')
    expect(s.secondsLeft).toBe(0)
    expect(demoProgress(s)).toBe(1)
    const session = demoSessionFrom(s, T0 + 400_000)
    expect(session).toEqual({ startedAt: new Date(T0).toISOString(), endedAt: new Date(T0 + 300_000).toISOString(), elapsedSeconds: 300 })
    // Done timers ignore start and pause.
    expect(demoReducer(s, { type: 'start', now: T0 + 400_000 }).status).toBe('done')
    expect(demoReducer(s, { type: 'reset' }).status).toBe('idle')
  })

  it('only changes duration while idle and resets to the same duration', () => {
    const idle = demoReducer(initialDemoState(25), { type: 'setDuration', minutes: 15 })
    expect(idle.totalSeconds).toBe(900)
    const running = demoReducer(idle, { type: 'start', now: T0 })
    expect(demoReducer(running, { type: 'setDuration', minutes: 5 }).totalSeconds).toBe(900)
    expect(demoReducer(running, { type: 'reset' })).toEqual(initialDemoState(15))
  })

  it('builds no session before anything ran, and never ends in the future', () => {
    expect(demoSessionFrom(initialDemoState(5), T0)).toBeNull()
    const started = demoReducer(initialDemoState(5), { type: 'start', now: T0 })
    expect(demoSessionFrom(started, T0)).toBeNull()
    const s = demoSessionFrom(started, T0 + 90_000)
    expect(s?.elapsedSeconds).toBe(90)
    expect(Date.parse(s!.endedAt)).toBeLessThanOrEqual(T0 + 90_000)
  })
})
