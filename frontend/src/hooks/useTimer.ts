import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { elapsedSeconds, initialState, nextBreak, reducer, type TimerState } from '../lib/timer'
import { formatClock } from '../lib/time'
import type { Settings, TimerMode } from '../types'

export interface TimerFinish {
  mode: TimerMode
  /** Seconds actually spent running, pauses excluded. */
  elapsedSeconds: number
  startedAt: string
  endedAt: string
  cycle: number
}

interface Options {
  settings: Settings
  onFinish: (result: TimerFinish) => void
}

export function useTimer({ settings, onFinish }: Options) {
  const [state, dispatch] = useReducer(reducer, settings, (s) => initialState(s))
  const onFinishRef = useRef(onFinish)
  const settingsRef = useRef(settings)
  useEffect(() => {
    onFinishRef.current = onFinish
    settingsRef.current = settings
  })

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

  // Completion: report the interval and move to the next one.
  const finishedRef = useRef<TimerState | null>(null)
  useEffect(() => {
    if (state.status !== 'running' || state.secondsLeft > 0 || finishedRef.current === state) return
    finishedRef.current = state
    const now = Date.now()
    const s = settingsRef.current
    const result: TimerFinish = {
      mode: state.mode,
      elapsedSeconds: Math.max(1, elapsedSeconds(state, now)),
      startedAt: new Date(state.startedAt ?? now - state.totalSeconds * 1000).toISOString(),
      endedAt: new Date(now).toISOString(),
      cycle: state.cycle,
    }
    const next: TimerMode = state.mode === 'work' ? nextBreak(state.cycle, s) : 'work'
    dispatch({ type: 'switch', mode: next, settings: s, autoStart: s.auto_start_breaks, now, advanceCycle: state.mode === 'work' })
    onFinishRef.current(result)
  }, [state])

  const start = useCallback(() => dispatch({ type: 'start', now: Date.now() }), [])
  const pause = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const toggle = useCallback(() => {
    dispatch(state.status === 'running' ? { type: 'pause', now: Date.now() } : { type: 'start', now: Date.now() })
  }, [state.status])
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
