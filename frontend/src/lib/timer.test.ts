import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import { elapsedSeconds, initialState, isLongBreakDue, nextBreak, reducer } from './timer'

const s = DEFAULT_SETTINGS
const t0 = 1_000_000

describe('timer reducer', () => {
  it('pausing keeps the remaining time instead of resetting', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'start', now: t0 })
    st = reducer(st, { type: 'tick', now: t0 + 5 * 60_000 })
    expect(st.secondsLeft).toBe(20 * 60)
    st = reducer(st, { type: 'pause', now: t0 + 5 * 60_000 })
    expect(st.status).toBe('paused')
    expect(st.secondsLeft).toBe(20 * 60)
    // A settings refresh while paused must not reset either.
    st = reducer(st, { type: 'settings', settings: s })
    expect(st.secondsLeft).toBe(20 * 60)
  })

  it('tracks elapsed running time excluding pauses', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'start', now: t0 })
    st = reducer(st, { type: 'pause', now: t0 + 60_000 })
    st = reducer(st, { type: 'start', now: t0 + 600_000 }) // 9 minutes paused
    const now = t0 + 660_000
    expect(elapsedSeconds(st, now)).toBe(120)
    expect(st.startedAt).toBe(t0)
  })

  it('resumes from the paused remaining time', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'start', now: t0 })
    st = reducer(st, { type: 'pause', now: t0 + 10 * 60_000 })
    st = reducer(st, { type: 'start', now: t0 + 20 * 60_000 })
    st = reducer(st, { type: 'tick', now: t0 + 25 * 60_000 })
    expect(st.secondsLeft).toBe(10 * 60)
  })

  it('counts down to zero and never below', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'start', now: t0 })
    st = reducer(st, { type: 'tick', now: t0 + 30 * 60_000 })
    expect(st.secondsLeft).toBe(0)
  })

  it('adjusts remaining and total consistently, with a 1-minute floor', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'adjust', deltaSeconds: 300, now: t0 })
    expect(st.secondsLeft).toBe(30 * 60)
    expect(st.totalSeconds).toBe(30 * 60)
    st = reducer(st, { type: 'adjust', deltaSeconds: -300, now: t0 })
    expect(st.secondsLeft).toBe(25 * 60)
    expect(st.totalSeconds).toBe(25 * 60)
    st = reducer(st, { type: 'adjust', deltaSeconds: -60 * 60, now: t0 })
    expect(st.secondsLeft).toBe(60)
    expect(st.totalSeconds).toBeGreaterThanOrEqual(60)
  })

  it('adjusting while running moves the target end time', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'start', now: t0 })
    st = reducer(st, { type: 'adjust', deltaSeconds: 300, now: t0 })
    expect(st.targetEndAt).toBe(t0 + 30 * 60_000)
    st = reducer(st, { type: 'tick', now: t0 + 60_000 })
    expect(st.secondsLeft).toBe(29 * 60)
  })

  it('applies new settings only when idle', () => {
    const longer = { ...s, work_duration: 50 }
    let st = initialState(s)
    st = reducer(st, { type: 'settings', settings: longer })
    expect(st.totalSeconds).toBe(50 * 60)
    st = reducer(st, { type: 'start', now: t0 })
    st = reducer(st, { type: 'settings', settings: s })
    expect(st.totalSeconds).toBe(50 * 60)
  })

  it('switch advances the cycle and can auto-start', () => {
    let st = initialState(s)
    st = reducer(st, { type: 'switch', mode: 'short_break', settings: s, autoStart: true, now: t0, advanceCycle: true })
    expect(st.cycle).toBe(2)
    expect(st.status).toBe('running')
    expect(st.totalSeconds).toBe(5 * 60)
    st = reducer(st, { type: 'switch', mode: 'work', settings: s, autoStart: false, now: t0 })
    expect(st.cycle).toBe(2)
    expect(st.status).toBe('idle')
  })

  it('long break falls on every Nth cycle', () => {
    expect(isLongBreakDue(1, s)).toBe(false)
    expect(isLongBreakDue(4, s)).toBe(true)
    expect(nextBreak(3, s)).toBe('short_break')
    expect(nextBreak(8, s)).toBe('long_break')
  })
})
