import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Save, Sparkles, UserPlus, LogIn } from 'lucide-react'
import confetti from 'canvas-confetti'
import { DEMO_DURATIONS, demoProgress, demoReducer, demoSessionFrom, demoStatusSentence, initialDemoState, type DemoDurationMin, type DemoSession } from '../../lib/demoTimer'
import { dashOffset, ringGeometry } from '../../lib/ring'
import { formatClock } from '../../lib/time'
import { notify, permission } from '../../lib/notify'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Button } from '../ui/Button'

interface Props {
  onSave: (session: DemoSession, intent: 'register' | 'login') => void
}

const RADIUS = 104
const STROKE = 8
const { size: SIZE, circumference: CIRC } = ringGeometry(RADIUS, STROKE)
const DEFAULT_TITLE = 'Study Tracker & Pomodoro'

/**
 * A real focus timer anyone can run before signing up. When it ends, or when
 * they choose to save mid-way, the elapsed session is handed to registration.
 */
export const DemoTimer: React.FC<Props> = ({ onSave }) => {
  const [state, dispatch] = useReducer(demoReducer, 25 as DemoDurationMin, initialDemoState)
  const [showSave, setShowSave] = useState(false)
  const reduced = useReducedMotion()
  const saveHeading = useRef<HTMLHeadingElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const running = state.status === 'running'

  // Tick on an interval and whenever the tab becomes visible again.
  useEffect(() => {
    if (!running) return
    const tick = () => dispatch({ type: 'tick', now: Date.now() })
    const id = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [running])

  // Tab title shows the countdown while running, like the real app.
  useEffect(() => {
    if (running) document.title = `${formatClock(state.secondsLeft)} · Focus · Study Tracker`
    else document.title = DEFAULT_TITLE
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [running, state.secondsLeft])

  // Completion: celebrate, notify if already allowed, and offer to save.
  useEffect(() => {
    if (state.status !== 'done') return
    setShowSave(true)
    if (permission() === 'granted') notify('Focus block done', 'Nice work. Create an account to keep it.')
    if (!reduced && ringRef.current) {
      const r = ringRef.current.getBoundingClientRect()
      confetti({ particleCount: 80, spread: 70, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }, colors: ['#34d399', '#4cc2f5', '#f5b63d', '#8b7cf6'] })
    }
  }, [state.status, reduced])

  useEffect(() => {
    if (showSave) saveHeading.current?.focus()
  }, [showSave])

  const requestSave = useCallback(() => {
    if (running) dispatch({ type: 'pause', now: Date.now() })
    setShowSave(true)
  }, [running])

  const session = demoSessionFrom(state, Date.now())
  const minutesDone = session ? Math.max(1, Math.round(session.elapsedSeconds / 60)) : 0
  const canSave = session !== null
  const progress = demoProgress(state)

  return (
    <div data-testid="demo-timer" className="relative mx-auto flex w-full max-w-sm flex-col items-center">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {demoStatusSentence(state)}
      </p>

      <div role="radiogroup" aria-label="Focus length" className="glass mb-5 flex items-center gap-1 rounded-full p-1">
        {DEMO_DURATIONS.map((m) => {
          const on = state.totalSeconds === m * 60
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={state.status !== 'idle'}
              onClick={() => dispatch({ type: 'setDuration', minutes: m })}
              className={`focus-ring rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${on ? 'bg-brand-500/15 text-brand-300' : 'text-ink-400 hover:text-ink-100'}`}
            >
              {m} min
            </button>
          )
        })}
      </div>

      <div ref={ringRef} className="relative" style={{ width: SIZE, height: SIZE }}>
        <span aria-hidden="true" className={`absolute inset-6 rounded-full bg-brand-500/25 blur-2xl ${running ? 'animate-breathe' : 'opacity-40'}`} />
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="demo-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--brand-300))" />
              <stop offset="100%" stopColor="rgb(var(--brand-600))" />
            </linearGradient>
          </defs>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-fg/[0.06]" />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="url(#demo-ring)" strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={dashOffset(CIRC, progress)} style={{ transition: 'stroke-dashoffset 300ms linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight text-ink-50" aria-hidden="true">
            {formatClock(state.secondsLeft)}
          </span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{state.status === 'done' ? 'Complete' : state.status === 'paused' ? 'Paused' : running ? 'Focusing' : 'Ready'}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button type="button" onClick={() => dispatch({ type: 'reset' })} aria-label="Reset" title="Reset" className="focus-ring glass flex h-11 w-11 items-center justify-center rounded-full text-ink-400 transition hover:text-ink-50">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        {state.status === 'done' ? (
          <Button size="lg" onClick={() => setShowSave(true)} icon={<Save className="h-4 w-4" aria-hidden="true" />}>
            Save this session
          </Button>
        ) : (
          <Button size="lg" onClick={() => dispatch({ type: running ? 'pause' : 'start', now: Date.now() })} icon={running ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}>
            {running ? 'Pause' : state.status === 'paused' ? 'Resume' : 'Start focusing'}
          </Button>
        )}
        {state.status !== 'done' && (
          <button type="button" onClick={requestSave} disabled={!canSave} aria-label="Save this session" title="Save this session" className="focus-ring glass flex h-11 w-11 items-center justify-center rounded-full text-ink-400 transition hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showSave && (
        <div className="card mt-6 w-full p-5 text-left animate-scale-in" role="region" aria-labelledby="demo-save-heading">
          <h3 id="demo-save-heading" ref={saveHeading} tabIndex={-1} className="flex items-center gap-2 text-base font-semibold text-ink-50 outline-none">
            <Sparkles className="h-4 w-4 text-brand-400" aria-hidden="true" />
            Keep this session
          </h3>
          <p className="mt-1.5 text-sm text-ink-400">
            {canSave ? `Create a free account and we will log these ${minutesDone} minute${minutesDone === 1 ? '' : 's'} to your first project.` : 'Run the timer for a moment first, then save it to a new account.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="md" disabled={!canSave} onClick={() => session && onSave(session, 'register')} icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}>
              Create account to save
            </Button>
            <Button size="md" variant="secondary" disabled={!canSave} onClick={() => session && onSave(session, 'login')} icon={<LogIn className="h-4 w-4" aria-hidden="true" />}>
              Use an existing account
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
