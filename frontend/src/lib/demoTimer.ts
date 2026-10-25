/**
 * The landing-page focus timer: no account, no server, timestamp-based so it
 * stays correct when the tab is throttled. Mirrors the shape of timer.ts but
 * keeps its own state so the app's persisted timer is never touched.
 */

export type DemoDurationMin = 5 | 15 | 25
export type DemoStatus = 'idle' | 'running' | 'paused' | 'done'

export interface DemoTimerState {
  status: DemoStatus
  totalSeconds: number
  secondsLeft: number
  /** Epoch ms when the countdown reaches zero (while running). */
  targetEndAt: number | null
  /** Epoch ms of the first start. */
  startedAt: number | null
  /** Running time from earlier segments, in ms. */
  accumulatedMs: number
  /** Epoch ms when the current running segment began. */
  runStartedAt: number | null
}

export type DemoTimerAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'setDuration'; minutes: DemoDurationMin }
  | { type: 'reset' }

export const DEMO_DURATIONS: DemoDurationMin[] = [5, 15, 25]

export function initialDemoState(minutes: DemoDurationMin = 25): DemoTimerState {
  const total = minutes * 60
  return { status: 'idle', totalSeconds: total, secondsLeft: total, targetEndAt: null, startedAt: null, accumulatedMs: 0, runStartedAt: null }
}

export function demoReducer(state: DemoTimerState, action: DemoTimerAction): DemoTimerState {
  switch (action.type) {
    case 'setDuration':
      return state.status === 'idle' ? initialDemoState(action.minutes) : state
    case 'reset':
      return initialDemoState((state.totalSeconds / 60) as DemoDurationMin)
    case 'start': {
      if (state.status === 'running' || state.status === 'done') return state
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
      const left = Math.max(0, Math.ceil(((state.targetEndAt ?? action.now) - action.now) / 1000))
      return {
        ...state,
        status: 'paused',
        secondsLeft: left,
        targetEndAt: null,
        accumulatedMs: state.accumulatedMs + (action.now - (state.runStartedAt ?? action.now)),
        runStartedAt: null,
      }
    }
    case 'tick': {
      if (state.status !== 'running' || state.targetEndAt === null) return state
      const remainingMs = state.targetEndAt - action.now
      if (remainingMs <= 0) {
        return {
          ...state,
          status: 'done',
          secondsLeft: 0,
          accumulatedMs: state.accumulatedMs + (state.targetEndAt - (state.runStartedAt ?? state.targetEndAt)),
          runStartedAt: null,
        }
      }
      const left = Math.ceil(remainingMs / 1000)
      return left === state.secondsLeft ? state : { ...state, secondsLeft: left }
    }
  }
}

/** Seconds actually spent running, including the current segment. */
export function demoElapsedSeconds(state: DemoTimerState, now: number): number {
  const live = state.status === 'running' && state.runStartedAt !== null ? now - state.runStartedAt : 0
  return Math.max(0, Math.round((state.accumulatedMs + live) / 1000))
}

/** 0..1 fraction of the interval completed, for the ring. */
export function demoProgress(state: DemoTimerState): number {
  if (state.totalSeconds <= 0) return 0
  return Math.max(0, Math.min(1, (state.totalSeconds - state.secondsLeft) / state.totalSeconds))
}

export interface DemoSession {
  startedAt: string
  endedAt: string
  elapsedSeconds: number
}

/**
 * The session to hand to the account, or null when nothing was run. A
 * running timer is treated as ending now so end_time is never in the future.
 */
export function demoSessionFrom(state: DemoTimerState, now: number): DemoSession | null {
  if (state.startedAt === null) return null
  const elapsed = demoElapsedSeconds(state, now)
  if (elapsed <= 0) return null
  const endedAt = state.status === 'done' && state.startedAt !== null ? state.startedAt + elapsed * 1000 : now
  return { startedAt: new Date(state.startedAt).toISOString(), endedAt: new Date(Math.min(endedAt, now)).toISOString(), elapsedSeconds: elapsed }
}

export function demoStatusSentence(state: DemoTimerState): string {
  switch (state.status) {
    case 'idle':
      return `Ready: ${state.totalSeconds / 60} minute focus block.`
    case 'running':
      return 'Focus block running.'
    case 'paused':
      return 'Focus block paused.'
    case 'done':
      return 'Focus block complete.'
  }
}
