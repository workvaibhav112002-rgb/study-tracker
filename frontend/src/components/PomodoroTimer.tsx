import React from 'react'
import { Play, Pause, RotateCcw, SkipForward, Plus, Minus, CheckCircle2, Coffee, Sparkles, FolderPlus } from 'lucide-react'
import type { Project, Settings, TimerMode } from '../types'
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
}

const MODES: { id: TimerMode; label: string; icon: React.ElementType; active: string }[] = [
  { id: 'work', label: 'Pomodoro', icon: Sparkles, active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm' },
  { id: 'short_break', label: 'Short Break', icon: Coffee, active: 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm' },
  { id: 'long_break', label: 'Long Break', icon: CheckCircle2, active: 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-sm' },
]

const MODE_STYLES: Record<TimerMode, { ring: string; button: string }> = {
  work: { ring: 'stroke-brand-500', button: 'bg-brand-500 hover:bg-brand-600 text-slate-950' },
  short_break: { ring: 'stroke-sky-400', button: 'bg-sky-400 hover:bg-sky-500 text-slate-950' },
  long_break: { ring: 'stroke-purple-400', button: 'bg-purple-400 hover:bg-purple-500 text-slate-950' },
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  timer,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  settings,
  onCreateProject,
}) => {
  const { state, formatted, progress } = timer
  const isRunning = state.status === 'running'
  const styles = MODE_STYLES[state.mode]

  const radius = 130
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference

  const interval = longBreakInterval(settings)
  const activeProject = projects.find((p) => p.id === selectedProjectId)
  const needsProject = state.mode === 'work' && projects.length === 0

  const withTick = (fn: () => void) => () => {
    if (settings.sound_enabled) audioService.playTick()
    fn()
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 max-w-xl mx-auto">
      <div role="group" aria-label="Timer mode" className="flex items-center space-x-1 sm:space-x-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 mb-8 shadow-inner">
        {MODES.map((m) => {
          const Icon = m.icon
          const active = state.mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => timer.switchMode(m.id)}
              aria-pressed={active}
              className={`px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active ? m.active : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{m.label}</span>
            </button>
          )
        })}
      </div>

      <div className="relative flex items-center justify-center my-2">
        <svg className="w-80 h-80 sm:w-96 sm:h-96 transform -rotate-90" aria-hidden="true">
          <circle cx="50%" cy="50%" r={radius} className="stroke-slate-900" strokeWidth="12" fill="transparent" />
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            className={`${styles.ring} transition-all duration-300 ease-out`}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          {state.mode === 'work' && (
            <div className="mb-2">
              {projects.length > 0 ? (
                <>
                  <label htmlFor="timer-project" className="sr-only">
                    Project for this session
                  </label>
                  <select
                    id="timer-project"
                    value={selectedProjectId ?? ''}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    className="bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-700/80 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer shadow-sm max-w-[220px]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        ● {p.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                >
                  <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Create a project to log sessions
                </button>
              )}
            </div>
          )}

          <span
            className="text-6xl sm:text-7xl font-extrabold tracking-tighter text-white font-mono drop-shadow-md tabular-nums"
            role="timer"
            aria-live={isRunning ? 'off' : 'polite'}
            aria-label={`${formatted} remaining`}
          >
            {formatted}
          </span>

          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <span>Cycle #{state.cycle}</span>
            <span className="text-slate-600" aria-hidden="true">
              •
            </span>
            <span>
              Interval {((state.cycle - 1) % interval) + 1} of {interval}
            </span>
          </div>

          <div className="flex items-center space-x-2 mt-4">
            <button
              type="button"
              onClick={withTick(() => timer.adjust(-300))}
              aria-label="Subtract 5 minutes"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all text-xs flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Minus className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" /> 5m
            </button>
            <button
              type="button"
              onClick={withTick(() => timer.adjust(300))}
              aria-label="Add 5 minutes"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all text-xs flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" /> 5m
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 mt-8">
        <button
          type="button"
          onClick={withTick(timer.reset)}
          aria-label="Reset timer"
          title="Reset timer"
          className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={withTick(timer.toggle)}
          disabled={needsProject}
          title={needsProject ? 'Create a project first' : undefined}
          className={`flex items-center space-x-2 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${styles.button}`}
        >
          {isRunning ? (
            <>
              <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-6 h-6 fill-current" aria-hidden="true" />
              <span>{state.status === 'paused' ? 'RESUME' : 'START'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={withTick(timer.skip)}
          aria-label="Skip to next interval"
          title="Skip to next interval"
          className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {activeProject && state.mode === 'work' && (
        <div className="mt-8 w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: activeProject.color }} aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{activeProject.name}</h3>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">
                {activeProject.description || `Target: ${activeProject.target_minutes_per_day} min/day`}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-slate-500 block">Daily Goal</span>
            <span className="text-xs font-semibold text-emerald-400">{activeProject.target_minutes_per_day}m</span>
          </div>
        </div>
      )}
    </div>
  )
}
