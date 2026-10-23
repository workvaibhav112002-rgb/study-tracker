import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Plus, Minus, CheckCircle2, Coffee, Sparkles } from 'lucide-react'
import { Project, Settings, TimerMode } from '../types'
import { audioService } from '../services/audio'
import confetti from 'canvas-confetti'

interface PomodoroTimerProps {
  projects: Project[]
  selectedProjectId: number | null
  setSelectedProjectId: (id: number) => void
  settings: Settings
  onWorkSessionComplete: (durationSeconds: number, startTime: string, endTime: string, projectId: number) => void
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  projects,
  selectedProjectId,
  setSelectedProjectId,
  settings,
  onWorkSessionComplete,
}) => {
  const [mode, setMode] = useState<TimerMode>('work')
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [sessionCount, setSessionCount] = useState<number>(1)

  // Durations in seconds based on current settings
  const getInitialSeconds = useCallback((targetMode: TimerMode) => {
    switch (targetMode) {
      case 'work':
        return (settings.work_duration || 25) * 60
      case 'short_break':
        return (settings.short_break_duration || 5) * 60
      case 'long_break':
        return (settings.long_break_duration || 15) * 60
    }
  }, [settings])

  const [totalSeconds, setTotalSeconds] = useState<number>(() => getInitialSeconds('work'))
  const [secondsLeft, setSecondsLeft] = useState<number>(() => getInitialSeconds('work'))

  // Session start tracking for logging
  const sessionStartTimeRef = useRef<Date | null>(null)
  const targetEndTimeRef = useRef<number | null>(null)

  // Update total seconds if settings change and timer is not running
  useEffect(() => {
    if (!isRunning) {
      const initial = getInitialSeconds(mode)
      setTotalSeconds(initial)
      setSecondsLeft(initial)
    }
  }, [settings, mode, isRunning, getInitialSeconds])

  // Timer mode transition
  const switchMode = useCallback((newMode: TimerMode, autoStart = false) => {
    setIsRunning(false)
    setMode(newMode)
    const secs = getInitialSeconds(newMode)
    setTotalSeconds(secs)
    setSecondsLeft(secs)
    sessionStartTimeRef.current = null
    targetEndTimeRef.current = null

    if (autoStart) {
      setTimeout(() => {
        setIsRunning(true)
        sessionStartTimeRef.current = new Date()
        targetEndTimeRef.current = Date.now() + secs * 1000
      }, 300)
    }
  }, [getInitialSeconds])

  // Complete session handler
  const handleSessionFinished = useCallback(() => {
    setIsRunning(false)
    targetEndTimeRef.current = null

    if (mode === 'work') {
      if (settings.sound_enabled) {
        audioService.playWorkCompleteChime()
      }

      // Celebrate with confetti!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#22c55e', '#3b82f6', '#eab308']
      })

      const now = new Date()
      const startTime = sessionStartTimeRef.current
        ? sessionStartTimeRef.current.toISOString()
        : new Date(now.getTime() - totalSeconds * 1000).toISOString()
      const endTime = now.toISOString()

      // Log session via callback
      if (selectedProjectId) {
        onWorkSessionComplete(totalSeconds, startTime, endTime, selectedProjectId)
      }

      // Determine next break mode
      const isLongBreak = sessionCount % (settings.long_break_interval || 4) === 0
      const nextMode: TimerMode = isLongBreak ? 'long_break' : 'short_break'
      setSessionCount((prev) => prev + 1)
      switchMode(nextMode, settings.auto_start_breaks)
    } else {
      // Break completed
      if (settings.sound_enabled) {
        audioService.playBreakCompleteChime()
      }
      switchMode('work', settings.auto_start_breaks)
    }
  }, [mode, settings, totalSeconds, selectedProjectId, sessionCount, onWorkSessionComplete, switchMode])

  // Drift-free interval runner
  useEffect(() => {
    if (!isRunning) return

    const timer = setInterval(() => {
      if (!targetEndTimeRef.current) return
      const now = Date.now()
      const diff = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000))
      setSecondsLeft(diff)

      if (diff <= 0) {
        clearInterval(timer)
        handleSessionFinished()
      }
    }, 250)

    return () => clearInterval(timer)
  }, [isRunning, handleSessionFinished])

  // Update browser document title
  useEffect(() => {
    const minutes = Math.floor(secondsLeft / 60)
    const seconds = secondsLeft % 60
    const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    const modeLabel = mode === 'work' ? 'Focus' : 'Break'
    document.title = isRunning ? `[${timeFormatted}] ${modeLabel} - Study Tracker` : 'Study Tracker & Pomodoro'
  }, [secondsLeft, mode, isRunning])

  // Start / Pause toggle
  const toggleStartPause = () => {
    audioService.playTick()
    if (!isRunning) {
      if (!sessionStartTimeRef.current) {
        sessionStartTimeRef.current = new Date()
      }
      targetEndTimeRef.current = Date.now() + secondsLeft * 1000
      setIsRunning(true)
    } else {
      setIsRunning(false)
      targetEndTimeRef.current = null
    }
  }

  // Reset timer
  const handleReset = () => {
    audioService.playTick()
    setIsRunning(false)
    const initial = getInitialSeconds(mode)
    setTotalSeconds(initial)
    setSecondsLeft(initial)
    sessionStartTimeRef.current = null
    targetEndTimeRef.current = null
  }

  // Skip to next mode
  const handleSkip = () => {
    audioService.playTick()
    if (mode === 'work') {
      const isLongBreak = sessionCount % (settings.long_break_interval || 4) === 0
      setSessionCount((prev) => prev + 1)
      switchMode(isLongBreak ? 'long_break' : 'short_break', false)
    } else {
      switchMode('work', false)
    }
  }

  // Quick adjust (+5m / -5m)
  const adjustTime = (deltaMinutes: number) => {
    audioService.playTick()
    const deltaSeconds = deltaMinutes * 60
    const newSeconds = Math.max(60, secondsLeft + deltaSeconds)
    setSecondsLeft(newSeconds)
    setTotalSeconds((prev) => Math.max(newSeconds, prev + deltaSeconds))
    if (isRunning && targetEndTimeRef.current) {
      targetEndTimeRef.current += deltaSeconds * 1000
    }
  }

  // Circular progress calculation
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0
  const radius = 130
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  // Format MM:SS
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  const activeProject = projects.find((p) => p.id === selectedProjectId)

  // Color schemes based on mode
  const modeColors = {
    work: {
      ring: 'stroke-brand-500',
      glow: 'shadow-emerald-500/20',
      badge: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
      button: 'bg-brand-500 hover:bg-brand-600 text-slate-950',
    },
    short_break: {
      ring: 'stroke-sky-400',
      glow: 'shadow-sky-500/20',
      badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      button: 'bg-sky-400 hover:bg-sky-500 text-slate-950',
    },
    long_break: {
      ring: 'stroke-purple-400',
      glow: 'shadow-purple-500/20',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      button: 'bg-purple-400 hover:bg-purple-500 text-slate-950',
    },
  }[mode]

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 max-w-xl mx-auto">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center space-x-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 mb-8 shadow-inner">
        <button
          onClick={() => switchMode('work')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2 ${
            mode === 'work'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Pomodoro</span>
        </button>
        <button
          onClick={() => switchMode('short_break')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2 ${
            mode === 'short_break'
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>Short Break</span>
        </button>
        <button
          onClick={() => switchMode('long_break')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2 ${
            mode === 'long_break'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Long Break</span>
        </button>
      </div>

      {/* Circular SVG Timer */}
      <div className="relative flex items-center justify-center my-2">
        <svg className="w-80 h-80 sm:w-96 sm:h-96 transform -rotate-90">
          {/* Background Track */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            className="stroke-slate-900"
            strokeWidth="12"
            fill="transparent"
          />
          {/* Animated Progress Ring */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            className={`${modeColors.ring} transition-all duration-300 ease-out`}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Inner Content */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          {/* Project Tag */}
          {mode === 'work' && (
            <div className="mb-2">
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                className="bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-700/80 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer shadow-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    ● {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time Display */}
          <span className="text-6xl sm:text-7xl font-extrabold tracking-tighter text-white font-mono drop-shadow-md">
            {formattedTime}
          </span>

          {/* Cycle Tracker Indicator */}
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <span>Cycle #{sessionCount}</span>
            <span className="text-slate-600">•</span>
            <span>Interval {((sessionCount - 1) % (settings.long_break_interval || 4)) + 1} of {settings.long_break_interval || 4}</span>
          </div>

          {/* Quick Adjust Buttons */}
          <div className="flex items-center space-x-2 mt-4">
            <button
              onClick={() => adjustTime(-5)}
              title="Minus 5 minutes"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all text-xs flex items-center"
            >
              <Minus className="w-3.5 h-3.5 mr-0.5" /> 5m
            </button>
            <button
              onClick={() => adjustTime(5)}
              title="Add 5 minutes"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all text-xs flex items-center"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" /> 5m
            </button>
          </div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center space-x-4 mt-8">
        <button
          onClick={handleReset}
          title="Reset Timer"
          className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-all hover:scale-105 active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={toggleStartPause}
          className={`flex items-center space-x-2 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all hover:scale-105 active:scale-95 ${modeColors.button}`}
        >
          {isRunning ? (
            <>
              <Pause className="w-6 h-6 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-6 h-6 fill-current" />
              <span>START</span>
            </>
          )}
        </button>

        <button
          onClick={handleSkip}
          title="Skip to next session"
          className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-all hover:scale-105 active:scale-95"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Active Project Details Card */}
      {activeProject && mode === 'work' && (
        <div className="mt-8 w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-3.5 h-3.5 rounded-full shadow-sm"
              style={{ backgroundColor: activeProject.color }}
            />
            <div>
              <h4 className="text-sm font-semibold text-white">{activeProject.name}</h4>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">
                {activeProject.description || 'Target: ' + activeProject.target_minutes_per_day + ' min/day'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Daily Goal</span>
            <span className="text-xs font-semibold text-emerald-400">{activeProject.target_minutes_per_day}m</span>
          </div>
        </div>
      )}
    </div>
  )
}
