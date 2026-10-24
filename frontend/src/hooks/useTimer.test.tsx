import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import { initialState, reducer } from '../lib/timer'
import { TIMER_KEY, loadTimer, saveTimer } from '../lib/timerStorage'
import { useTimer } from './useTimer'
import { api } from '../api/client'

const t0 = new Date('2026-10-24T10:00:00Z').getTime()

describe('useTimer persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(t0)
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists on start and rehydrates a running countdown', () => {
    const onFinish = vi.fn()
    const { result, unmount } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    act(() => result.current.start())
    expect(loadTimer(1)?.status).toBe('running')
    unmount()

    vi.setSystemTime(t0 + 10 * 60_000)
    const second = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    expect(second.result.current.state.status).toBe('running')
    expect(second.result.current.state.secondsLeft).toBe(15 * 60)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('adopts the persisted state once the user id arrives after mount', () => {
    const running = reducer(initialState(DEFAULT_SETTINGS), { type: 'start', now: t0 })
    saveTimer(1, running)
    const onFinish = vi.fn()
    const { result, rerender } = renderHook(
      ({ userId }: { userId: number | null }) => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId, notificationsEnabled: false }),
      { initialProps: { userId: null as number | null } },
    )
    expect(result.current.state.status).toBe('idle')
    expect(loadTimer(1)?.status).toBe('running') // anonymous mount must not clobber it
    vi.setSystemTime(t0 + 5 * 60_000)
    rerender({ userId: 1 })
    expect(result.current.state.status).toBe('running')
    expect(result.current.state.secondsLeft).toBe(20 * 60)
  })

  it('reports a timer that finished while closed, once, as of its target time', () => {
    let st = reducer(initialState(DEFAULT_SETTINGS), { type: 'start', now: t0 })
    st = reducer(st, { type: 'interrupt' })
    saveTimer(1, st)
    vi.setSystemTime(t0 + 60 * 60_000)
    const onFinish = vi.fn()
    renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    const r = onFinish.mock.calls[0][0]
    expect(r.endedAt).toBe(new Date(t0 + 25 * 60_000).toISOString())
    expect(r.elapsedSeconds).toBe(25 * 60)
    expect(r.interruptions).toBe(1)
    expect(r.stale).toBe(true)
  })

  it('never persists the transient running-at-zero state', () => {
    const onFinish = vi.fn()
    const { result } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    act(() => result.current.start())
    act(() => {
      vi.setSystemTime(t0 + 25 * 60_000 + 500)
      vi.advanceTimersByTime(250)
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
    const saved = loadTimer(1)
    expect(saved && saved.status === 'running' && saved.secondsLeft === 0).toBe(false)
    expect(saved?.mode).toBe('short_break')
  })

  it('does not write back state received from another tab', () => {
    const onFinish = vi.fn()
    const { result } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const remote = reducer(initialState(DEFAULT_SETTINGS), { type: 'start', now: t0 })
    localStorage.setItem(TIMER_KEY, JSON.stringify({ v: 1, userId: 1, state: remote }))
    setItem.mockClear()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: TIMER_KEY, newValue: 'x' }))
    })
    expect(result.current.state.status).toBe('running')
    expect(setItem).not.toHaveBeenCalledWith(TIMER_KEY, expect.anything())
    setItem.mockRestore()
  })

  it('counts hidden-tab events as interruptions only while focusing', () => {
    const onFinish = vi.fn()
    const { result } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    const hide = () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    }
    act(hide)
    expect(result.current.state.interruptions).toBe(0)
    act(() => result.current.start())
    act(hide)
    expect(result.current.state.interruptions).toBe(1)
  })
})

describe('useTimer cross-device sync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(t0)
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('adopts a fresh server snapshot but ignores a day-old one', async () => {
    const running = reducer(initialState(DEFAULT_SETTINGS), { type: 'start', now: t0 - 60_000 })
    const onFinish = vi.fn()
    const getTimer = vi.spyOn(api, 'getTimer').mockResolvedValue({ state: running, updated_at: t0 - 60_000 })
    vi.spyOn(api, 'putTimer').mockResolvedValue({ state: running, updated_at: t0 })
    const { result, unmount } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 1, notificationsEnabled: false }))
    await vi.waitFor(() => expect(result.current.state.status).toBe('running'))
    expect(result.current.state.secondsLeft).toBe(24 * 60)
    unmount()

    localStorage.clear()
    const old = reducer(initialState(DEFAULT_SETTINGS), { type: 'start', now: t0 - 2 * 24 * 3600_000 })
    getTimer.mockResolvedValue({ state: old, updated_at: t0 - 2 * 24 * 3600_000 })
    const second = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS, onFinish, userId: 2, notificationsEnabled: false }))
    await vi.waitFor(() => expect(getTimer).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 20))
    expect(second.result.current.state.status).toBe('idle')
    expect(onFinish).not.toHaveBeenCalled()
  })
})
