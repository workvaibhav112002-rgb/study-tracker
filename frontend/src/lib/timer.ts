import type { Settings, TimerMode } from '../types'

export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerState {
  mode: TimerMode
  status: TimerStatus
  /** Planned length of the current interval, in seconds (drives the ring). */
  totalSeconds: number
  secondsLeft: number
  /** Epoch ms at which the running countdown reaches zero. */
  targetEndAt: number | null
  /** Epoch ms of the first start of this interval (for session start_time). */
  startedAt: number | null
  /** Running time accumulated across earlier run segments, in ms. */
  accumulatedMs: number
  /** Epoch ms when the current run segment began. */
  runStartedAt: number | null
  /** 1-based pomodoro counter. */
  cycle: number
  /** Pauses and tab switches during the current focus interval. */
  interruptions: number
}

export type TimerAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'interrupt' }
  | { type: 'reset'; settings: Settings }
  | { type: 'switch'; mode: TimerMode; settings: Settings; autoStart: boolean; now: number; advanceCycle?: boolean }
  | { type: 'adjust'; deltaSeconds: number; now: number }
  | { type: 'settings'; settings: Settings }
  | { type: 'hydrate'; state: TimerState; now: number }

export const MIN_SECONDS = 60

const MODES: readonly TimerMode[] = ['work', 'short_break', 'long_break']
const STATUSES: readonly TimerStatus[] = ['idle', 'running', 'paused']

export function durationFor(mode: TimerMode, settings: Settings): number {
  switch (mode) {
    case 'work':
      return Math.max(1, settings.work_duration || 25) * 60
    case 'short_break':
      return Math.max(1, settings.short_break_duration || 5) * 60
    case 'long_break':
      return Math.max(1, settings.long_break_duration || 15) * 60
  }
}

export function initialState(settings: Settings, mode: TimerMode = 'work', cycle = 1): TimerState {
  const total = durationFor(mode, settings)
  return {
    mode,
    status: 'idle',
    totalSeconds: total,
    secondsLeft: total,
    targetEndAt: null,
    startedAt: null,
    accumulatedMs: 0,
    runStartedAt: null,
    cycle,
    interruptions: 0,
  }
}

/** Structural check used when reading persisted state. */
export function isTimerState(x: unknown): x is TimerState {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  const numOrNull = (v: unknown) => v === null || num(v)
  return (
    MODES.includes(s.mode as TimerMode) &&
    STATUSES.includes(s.status as TimerStatus) &&
    num(s.totalSeconds) &&
    num(s.secondsLeft) &&
    numOrNull(s.targetEndAt) &&
    numOrNull(s.startedAt) &&
    num(s.accumulatedMs) &&
    numOrNull(s.runStartedAt) &&
    num(s.cycle) &&
    num(s.interruptions)
  )
}

export function longBreakInterval(settings: Settings): number {
  return Math.max(1, settings.long_break_interval || 4)
}

export function isLongBreakDue(cycle: number, settings: Settings): boolean {
  return cycle % longBreakInterval(settings) === 0
}

export function nextBreak(cycle: number, settings: Settings): TimerMode {
  return isLongBreakDue(cycle, settings) ? 'long_break' : 'short_break'
}

/** Seconds the timer has actually been running (pauses excluded). */
export function elapsedSeconds(state: TimerState, now: number): number {
  const running = state.runStartedAt !== null ? Math.max(0, now - state.runStartedAt) : 0
  return Math.round((state.accumulatedMs + running) / 1000)
}

function remaining(state: TimerState, now: number): number {
  if (state.targetEndAt === null) return state.secondsLeft
  return Math.max(0, Math.round((state.targetEndAt - now) / 1000))
}

export function reducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'start': {
      if (state.status === 'running' || state.secondsLeft <= 0) return state
      return {
        ...state,
        status: 'running',
        targetEndAt: action.now + state.secondsLeft * 1000,
        startedAt: state.startedAt ?? action.now,
        runStartedAt: action.now,
      }
    }
    case 'pause': {
      if (state.status !== 'running') return state
      const left = remaining(state, action.now)
      return {
        ...state,
        status: 'paused',
        secondsLeft: left,
        targetEndAt: null,
        accumulatedMs: state.accumulatedMs + (state.runStartedAt !== null ? action.now - state.runStartedAt : 0),
        runStartedAt: null,
        interruptions: state.mode === 'work' ? state.interruptions + 1 : state.interruptions,
      }
    }
    case 'tick': {
      if (state.status !== 'running') return state
      const left = remaining(state, action.now)
      return left === state.secondsLeft ? state : { ...state, secondsLeft: left }
    }
    case 'interrupt':
      if (state.status !== 'running' || state.mode !== 'work') return state
      return { ...state, interruptions: state.interruptions + 1 }
    case 'reset':
      return initialState(action.settings, state.mode, state.cycle)
    case 'switch': {
      const base = initialState(action.settings, action.mode, action.advanceCycle ? state.cycle + 1 : state.cycle)
      return action.autoStart ? reducer(base, { type: 'start', now: action.now }) : base
    }
    case 'adjust': {
      const current = remaining(state, action.now)
      const left = Math.max(MIN_SECONDS, current + action.deltaSeconds)
      const applied = left - current
      const total = Math.max(left, state.totalSeconds + applied)
      return {
        ...state,
        secondsLeft: left,
        totalSeconds: total,
        targetEndAt: state.status === 'running' ? action.now + left * 1000 : null,
      }
    }
    case 'settings':
      // Never clobber an interval that is in progress.
      return state.status === 'idle' ? initialState(action.settings, state.mode, state.cycle) : state
    case 'hydrate': {
      const s = action.state
      if (s.status === 'running' && s.targetEndAt !== null) {
        return { ...s, secondsLeft: remaining(s, action.now) }
      }
      return s
    }
  }
}
