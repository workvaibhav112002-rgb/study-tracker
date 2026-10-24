import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { elapsedSeconds, initialState, nextBreak, reducer, type TimerState } from '../lib/timer'
import { TIMER_KEY, loadTimer, saveTimer } from '../lib/timerStorage'
import { formatClock } from '../lib/time'
import { permission, requestPermission } from '../lib/notify'
import { api } from '../api/client'
import { isTimerState } from '../lib/timer'
import type { Settings, TimerMode } from '../types'

export interface TimerFinish {
  mode: TimerMode
  /** Seconds actually spent running, pauses excluded. */
  elapsedSeconds: number
  startedAt: string
  endedAt: string
  cycle: number
  interruptions: number
  /** True when the interval ended while the app was closed. */
  stale: boolean
}

interface Options {
  settings: Settings
  onFinish: (result: TimerFinish) => void
  userId: number | null
  notificationsEnabled: boolean
}

const STALE_MS = 5_000

export function useTimer({ settings, onFinish, userId, notificationsEnabled }: Options) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const saved = loadTimer(userId)
    return saved ? reducer(saved, { type: 'hydrate', state: saved, now: Date.now() }) : initialState(settings)
  })
  const onFinishRef = useRef(onFinish)
  const settingsRef = useRef(settings)
  const notifyRef = useRef(notificationsEnabled)
  useEffect(() => {
    onFinishRef.current = onFinish
    settingsRef.current = settings
    notifyRef.current = notificationsEnabled
  })

  // The hook mounts before the user is known. Once the id arrives, adopt the
  // state persisted for that user (if any). Declared before the save effect so
  // the stored state is read into memory before anything is written.
  const hydratedFor = useRef<number | null>(null)
  useEffect(() => {
    if (userId === null || hydratedFor.current === userId) return
    hydratedFor.current = userId
    const saved = loadTimer(userId)
    if (saved) dispatch({ type: 'hydrate', state: saved, now: Date.now() })
  }, [userId])

  // Persist every transition except ones that just arrived from another tab.
  // Nothing is written for an anonymous session.
  const fromStorage = useRef(false)
  useEffect(() => {
    if (fromStorage.current) {
      fromStorage.current = false
      return
    }
    if (userId === null) return
    // The transient "running at zero" state is never persisted: another tab
    // would hydrate into it and report the same completion a second time.
    if (state.status === 'running' && state.secondsLeft === 0) return
    saveTimer(userId, state)
  }, [state, userId])

  // Cross-tab sync. `storage` only fires in other tabs, so there is no echo.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TIMER_KEY) return
      if (e.newValue === null) {
        fromStorage.current = true
        dispatch({ type: 'reset', settings: settingsRef.current })
        return
      }
      const saved = loadTimer(userId)
      if (!saved) return
      fromStorage.current = true
      dispatch({ type: 'hydrate', state: saved, now: Date.now() })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])

  // Cross-device sync. Structural changes (not ticks) are pushed to the
  // server; on mount, focus and return-to-tab the server copy is adopted
  // when it is newer than the last local change. Last write wins.
  const lastLocalChange = useRef(0)
  const structural = `${state.mode}|${state.status}|${state.cycle}|${state.targetEndAt}|${state.totalSeconds}|${state.startedAt}|${state.accumulatedMs}`
  const prevStructural = useRef(structural)
  const pushTimer = useRef<number | null>(null)
  useEffect(() => {
    if (prevStructural.current === structural) return
    prevStructural.current = structural
    if (fromStorage.current || userId === null) return
    const stamp = Date.now()
    lastLocalChange.current = stamp
    if (pushTimer.current) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      api.putTimer(state, stamp).catch(() => undefined)
    }, 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structural, userId])

  useEffect(() => {
    if (userId === null) return
    let cancelled = false
    const pull = async () => {
      try {
        const snap = await api.getTimer<unknown>()
        if (cancelled || !snap.state || !isTimerState(snap.state) || snap.updated_at <= lastLocalChange.current) return
        lastLocalChange.current = snap.updated_at
        const remote = snap.state
        prevStructural.current = `${remote.mode}|${remote.status}|${remote.cycle}|${remote.targetEndAt}|${remote.totalSeconds}|${remote.startedAt}|${remote.accumulatedMs}`
        dispatch({ type: 'hydrate', state: remote, now: Date.now() })
      } catch {
        /* offline or unreachable: keep local */
      }
    }
    void pull()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [userId])

  // Pick up new durations when idle.
  useEffect(() => {
    dispatch({ type: 'settings', settings })
  }, [settings])

  // Drift-free ticking: the countdown derives from a target timestamp, so a
  // throttled background tab catches up on the next tick or on focus.
  useEffect(() => {
    if (state.status !== 'running') return
    const tick = () => dispatch({ type: 'tick', now: Date.now() })
    const id = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [state.status])

  // Leaving the tab during a focus interval counts as an interruption.
  useEffect(() => {
    if (state.status !== 'running' || state.mode !== 'work') return
    const onVis = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'interrupt' })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [state.status, state.mode])

  // Completion: report once, then move to the next interval. A timer that
  // finished while the app was closed is reported as of its target time
  // without auto-starting the next interval.
  const finishedRef = useRef<TimerState | null>(null)
  useEffect(() => {
    if (state.status !== 'running' || state.secondsLeft > 0 || finishedRef.current === state) return
    finishedRef.current = state
    const endedAtMs = state.targetEndAt ?? Date.now()
    const stale = Date.now() - endedAtMs > STALE_MS
    const s = settingsRef.current
    const result: TimerFinish = {
      mode: state.mode,
      elapsedSeconds: Math.max(1, elapsedSeconds(state, endedAtMs)),
      startedAt: new Date(state.startedAt ?? endedAtMs - state.totalSeconds * 1000).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
      cycle: state.cycle,
      interruptions: state.interruptions,
      stale,
    }
    const next: TimerMode = state.mode === 'work' ? nextBreak(state.cycle, s) : 'work'
    dispatch({ type: 'switch', mode: next, settings: s, autoStart: s.auto_start_breaks && !stale, now: Date.now(), advanceCycle: state.mode === 'work' })
    onFinishRef.current(result)
  }, [state])

  const start = useCallback(() => {
    // Ask for notification permission inside the user gesture that starts the timer.
    if (notifyRef.current && permission() === 'default') void requestPermission()
    dispatch({ type: 'start', now: Date.now() })
  }, [])
  const pause = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const toggle = useCallback(() => {
    if (state.status === 'running') pause()
    else start()
  }, [state.status, start, pause])
  const reset = useCallback(() => dispatch({ type: 'reset', settings: settingsRef.current }), [])
  const switchMode = useCallback(
    (mode: TimerMode) => dispatch({ type: 'switch', mode, settings: settingsRef.current, autoStart: false, now: Date.now() }),
    [],
  )
  const skip = useCallback(() => {
    const s = settingsRef.current
    if (state.mode === 'work') {
      dispatch({ type: 'switch', mode: nextBreak(state.cycle, s), settings: s, autoStart: false, now: Date.now(), advanceCycle: true })
    } else {
      dispatch({ type: 'switch', mode: 'work', settings: s, autoStart: false, now: Date.now() })
    }
  }, [state.mode, state.cycle])
  const adjust = useCallback((deltaSeconds: number) => dispatch({ type: 'adjust', deltaSeconds, now: Date.now() }), [])

  const formatted = useMemo(() => formatClock(state.secondsLeft), [state.secondsLeft])
  const progress = state.totalSeconds > 0 ? ((state.totalSeconds - state.secondsLeft) / state.totalSeconds) * 100 : 0

  return { state, start, pause, toggle, reset, switchMode, skip, adjust, formatted, progress }
}
