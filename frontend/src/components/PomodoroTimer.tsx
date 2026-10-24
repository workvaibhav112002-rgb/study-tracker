import React, { useId } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Plus, Minus, Coffee, Sparkles, Moon, FolderPlus, ChevronDown } from 'lucide-react'
import type { GoalStat, Project, Settings, TimerMode } from '../types'
import { GoalRing } from './ui/GoalRing'
import type { useTimer } from '../hooks/useTimer'
import { longBreakInterval } from '../lib/timer'
import { audioService } from '../services/audio'

interface PomodoroTimerProps {
  timer: ReturnType<typeof useTimer>
  projects: Project[]
  selectedProjectId: number | null
  setSelectedProjectId: (id: number) => void
  settings: Settings
  onCreateProject: () => void
  goal?: GoalStat
}

interface ModeStyle {
  label: string
  eyebrow: string
  icon: React.ElementType
  from: string
  to: string
  glow: string
  chip: string
  cta: string
}

const MODES: Record<TimerMode, ModeStyle> = {
  work: {
    label: 'Focus',
    eyebrow: 'Focus session',
    icon: Sparkles,
    from: '#6ee7b7',
    to: '#059669',
    glow: 'rgb(16 185 129 / 0.45)',
    chip: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
    cta: 'from-brand-400 to-brand-600 text-surface-950 shadow-glow hover:from-brand-300 hover:to-brand-500',
  },
  short_break: {
    label: 'Short break',
    eyebrow: 'Short break',
    icon: Coffee,
    from: '#7dd3fc',
    to: '#0284c7',
    glow: 'rgb(56 189 248 / 0.4)',
    chip: 'border-sky-400/30 bg-sky-400/15 text-sky-300',
    cta: 'from-sky-300 to-sky-500 text-surface-950 shadow-[0_12px_40px_-12px_rgb(56_189_248/0.55)] hover:from-sky-200 hover:to-sky-400',
  },
  long_break: {
    label: 'Long break',
    eyebrow: 'Long break',
    icon: Moon,
    from: '#c4b5fd',
    to: '#7c3aed',
    glow: 'rgb(139 124 246 / 0.4)',
    chip: 'border-violet-400/30 bg-violet-400/15 text-violet-300',
    cta: 'from-violet-300 to-violet-500 text-surface-950 shadow-[0_12px_40px_-12px_rgb(139_124_246/0.55)] hover:from-violet-200 hover:to-violet-400',
  },
}

const RADIUS = 150
const STROKE = 10
const SIZE = (RADIUS + STROKE) * 2

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  timer,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  settings,
  onCreateProject,
  goal,
}) => {
  const gradId = useId()
  const { state, formatted, progress } = timer
  const isRunning = state.status === 'running'
  const mode = MODES[state.mode]
  const circumference = 2 * Math.PI * RADIUS
  const dashOffset = circumference - (progress / 100) * circumference

  const interval = longBreakInterval(settings)
  const activeProject = projects.find((p) => p.id === selectedProjectId)
  const needsProject = state.mode === 'work' && projects.length === 0

  const withTick = (fn: () => void) => () => {
    if (settings.sound_enabled) audioService.playTick()
    fn()
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-2 pb-8 pt-4 sm:pt-8" aria-label="Pomodoro timer">
      {/* Mode switcher */}
      <div role="group" aria-label="Timer mode" className="glass flex items-center gap-1 rounded-full p-1 shadow-card">
        {(Object.keys(MODES) as TimerMode[]).map((id) => {
          const m = MODES[id]
          const Icon = m.icon
          const active = state.mode === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => timer.switchMode(id)}
              aria-pressed={active}
              className={`focus-ring flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all duration-200 ease-premium sm:px-4 ${
                active ? `border ${m.chip} shadow-inner-hi` : 'border border-transparent text-ink-400 hover:text-ink-100'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className={active ? '' : 'hidden sm:inline'}>{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Ring */}
      <div className="relative mt-8 flex items-center justify-center sm:mt-10">
        <div
          aria-hidden="true"
          className={`absolute inset-6 rounded-full blur-3xl transition-opacity duration-700 ${isRunning ? 'animate-breathe opacity-100' : 'opacity-40'}`}
          style={{ background: mode.glow }}
        />
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative h-[300px] w-[300px] -rotate-90 sm:h-[340px] sm:w-[340px]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={SIZE} y2={SIZE}>
              <stop offset="0%" stopColor={mode.from} />
              <stop offset="100%" stopColor={mode.to} />
            </linearGradient>
          </defs>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} className="stroke-white/[0.06]" strokeWidth={STROKE} fill="transparent" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={`url(#${gradId})`}
            strokeWidth={STROKE}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 250ms linear', filter: `drop-shadow(0 0 12px ${mode.glow})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`chip mb-3 ${mode.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'animate-breathe bg-current' : 'bg-current opacity-50'}`} aria-hidden="true" />
            {isRunning ? 'Running' : state.status === 'paused' ? 'Paused' : mode.eyebrow}
          </span>

          <span
            className="font-mono text-[64px] font-semibold leading-none tracking-tight text-ink-50 tabular-nums sm:text-[76px]"
            role="timer"
            aria-live={isRunning ? 'off' : 'polite'}
            aria-label={`${formatted} remaining`}
          >
            {formatted}
          </span>

          <p className="mt-3 text-xs font-medium text-ink-500">
            Cycle {state.cycle} <span className="mx-1.5 text-ink-700">·</span> {((state.cycle - 1) % interval) + 1} of {interval} before a long break
          </p>

          {state.mode === 'work' && (
            <div className="mt-4">
              {projects.length > 0 ? (
                <div className="relative">
                  <label htmlFor="timer-project" className="sr-only">
                    Project for this session
                  </label>
                  <select
                    id="timer-project"
                    value={selectedProjectId ?? ''}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    className="focus-ring glass max-w-[220px] cursor-pointer appearance-none rounded-full py-1.5 pl-3.5 pr-8 text-xs font-medium text-ink-100 transition hover:border-white/20"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="focus-ring chip border-accent-amber/30 bg-accent-amber/10 text-amber-200 hover:bg-accent-amber/20"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Create a project to log sessions
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick adjust */}
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={withTick(() => timer.adjust(-300))}
          aria-label="Subtract 5 minutes"
          className="focus-ring chip border-white/[0.06] bg-white/[0.04] text-ink-400 transition hover:bg-white/[0.08] hover:text-ink-100"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" /> 5 min
        </button>
        <button
          type="button"
          onClick={withTick(() => timer.adjust(300))}
          aria-label="Add 5 minutes"
          className="focus-ring chip border-white/[0.06] bg-white/[0.04] text-ink-400 transition hover:bg-white/[0.08] hover:text-ink-100"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> 5 min
        </button>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={withTick(timer.reset)}
          aria-label="Reset timer"
          title="Reset (R)"
          className="focus-ring glass flex h-12 w-12 items-center justify-center rounded-full text-ink-400 transition-all duration-200 ease-premium hover:text-ink-50 hover:scale-105 active:scale-95"
        >
          <RotateCcw className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={withTick(timer.toggle)}
          disabled={needsProject}
          title={needsProject ? 'Create a project first' : 'Start / pause (Space)'}
          className={`focus-ring flex h-14 min-w-[172px] items-center justify-center gap-2.5 rounded-full bg-gradient-to-b px-9 text-[15px] font-semibold tracking-wide transition-all duration-200 ease-premium hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 ${mode.cta}`}
        >
          {isRunning ? (
            <>
              <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              {state.status === 'paused' ? 'Resume' : 'Start'}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={withTick(timer.skip)}
          aria-label="Skip to next interval"
          title="Skip to next interval"
          className="focus-ring glass flex h-12 w-12 items-center justify-center rounded-full text-ink-400 transition-all duration-200 ease-premium hover:text-ink-50 hover:scale-105 active:scale-95"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-5 hidden items-center gap-3 text-[11px] text-ink-600 sm:flex" aria-hidden="true">
        <span>
          <kbd className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-400">Space</kbd> start / pause
        </span>
        <span>
          <kbd className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-400">R</kbd> reset
        </span>
      </p>

      {/* Active project */}
      {activeProject && state.mode === 'work' && (
        <div className="card card-hover mt-8 flex w-full items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04]" aria-hidden="true">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeProject.color, boxShadow: `0 0 16px ${activeProject.color}` }} />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Studying</p>
              <h3 className="truncate text-[15px] font-semibold text-ink-50">{activeProject.name}</h3>
              {activeProject.description && <p className="truncate text-xs text-ink-500">{activeProject.description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="eyebrow">Today</p>
              <p className="font-mono text-sm tabular-nums text-ink-100">
                {goal?.today_minutes ?? 0} <span className="text-ink-500">/ {activeProject.target_minutes_per_day} min</span>
              </p>
            </div>
            <GoalRing today={goal?.today_minutes ?? 0} target={activeProject.target_minutes_per_day} color={activeProject.color} size={48} />
          </div>
        </div>
      )}
    </section>
  )
}
