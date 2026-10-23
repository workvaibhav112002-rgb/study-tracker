import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquareHeart } from 'lucide-react'
import confetti from 'canvas-confetti'
import { Navbar, type Tab } from './components/Navbar'
import { PomodoroTimer } from './components/PomodoroTimer'
import { SessionModal } from './components/SessionModal'
import { ManualSessionModal } from './components/ManualSessionModal'
import { ProjectManager } from './components/ProjectManager'
import { HistoryTable } from './components/HistoryTable'
import { SettingsModal } from './components/SettingsModal'
import { AuthModal } from './components/AuthModal'
import { FeedbackModal } from './components/FeedbackModal'
import { ToastProvider, useToast } from './components/ui/Toast'
import { ServerStatusBanner } from './components/ui/ServerStatusBanner'
import { useAuth } from './hooks/useAuth'
import { useAppData } from './hooks/useAppData'
import { useTimer, type TimerFinish } from './hooks/useTimer'
import { errorMessage } from './api/client'
import { audioService } from './services/audio'

// Recharts is heavy; load it only when the analytics tab is opened.
const AnalyticsDashboard = lazy(() =>
  import('./components/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })),
)

export const App: React.FC = () => (
  <ToastProvider>
    <AppShell />
  </ToastProvider>
)

const AppShell: React.FC = () => {
  const toast = useToast()
  const auth = useAuth()
  const data = useAppData(auth.user?.id ?? null)

  const [activeTab, setActiveTab] = useState<Tab>('timer')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [createProjectSignal, setCreateProjectSignal] = useState(0)
  const [completed, setCompleted] = useState<TimerFinish | null>(null)

  // Wrap a mutation so failures surface as a toast and still reject for the
  // calling form (which keeps itself open).
  const run = useCallback(
    async (fn: () => Promise<void>, success?: string) => {
      try {
        await fn()
        if (success) toast.success(success)
      } catch (err) {
        toast.error(errorMessage(err))
        throw err
      }
    },
    [toast],
  )

  const onTimerFinish = useCallback(
    (result: TimerFinish) => {
      if (result.mode === 'work') {
        if (data.settings.sound_enabled) audioService.playWorkCompleteChime()
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#22c55e', '#3b82f6', '#eab308'] })
        setCompleted(result)
      } else if (data.settings.sound_enabled) {
        audioService.playBreakCompleteChime()
      }
    },
    [data.settings.sound_enabled],
  )

  // The timer lives here so it keeps running while other tabs are open.
  const timer = useTimer({ settings: data.settings, onFinish: onTimerFinish })

  useEffect(() => {
    const label = timer.state.mode === 'work' ? 'Focus' : 'Break'
    document.title = timer.state.status === 'running' ? `[${timer.formatted}] ${label} · Study Tracker` : 'Study Tracker & Pomodoro'
  }, [timer.formatted, timer.state.mode, timer.state.status])

  const saveCompletedSession = async (projectId: number, rating: number, notes: string) => {
    if (!completed) return
    await run(
      () =>
        data.createSession({
          project_id: projectId,
          start_time: completed.startedAt,
          end_time: completed.endedAt,
          duration_seconds: completed.elapsedSeconds,
          session_type: 'pomodoro',
          focus_rating: rating,
          notes,
        }),
      'Session saved.',
    )
    setCompleted(null)
  }

  const requestCreateProject = () => {
    setActiveTab('projects')
    setCreateProjectSignal((n) => n + 1)
  }

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 gap-3" role="status">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        <span className="text-sm">Signing you in…</span>
      </div>
    )
  }

  const signedIn = auth.status === 'authenticated' && auth.user

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      <ServerStatusBanner authStatus={auth.status} onRetry={() => void auth.retry()} />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={auth.logout}
        stats={data.stats}
        user={auth.user}
        timerRunning={timer.state.status === 'running'}
        timerLabel={timer.formatted}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4" aria-busy={data.loading && !data.loaded}>
        {signedIn && data.error && !data.loaded && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
            <span>{data.error}</span>
            <button type="button" onClick={() => void data.reload()} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {activeTab === 'timer' && (
          <PomodoroTimer
            timer={timer}
            projects={data.projects}
            selectedProjectId={data.selectedProjectId}
            setSelectedProjectId={data.setSelectedProjectId}
            settings={data.settings}
            onCreateProject={requestCreateProject}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectManager
            projects={data.projects}
            openCreateSignal={createProjectSignal}
            onCreateProject={(p) => run(() => data.createProject(p), 'Project created.')}
            onUpdateProject={(id, p) => run(() => data.updateProject(id, p), 'Project updated.')}
            onDeleteProject={(id) => run(() => data.deleteProject(id), 'Project deleted.')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTable
            sessions={data.sessions}
            projects={data.projects}
            onDeleteSession={(id) => run(() => data.deleteSession(id), 'Entry deleted.')}
            onOpenManualModal={() => setIsManualOpen(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2" role="status">
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Loading analytics…
              </div>
            }
          >
            <AnalyticsDashboard stats={data.stats} loading={data.loading} error={data.error} onRetry={() => void data.reload()} />
          </Suspense>
        )}
      </main>

      <SessionModal
        isOpen={completed !== null}
        onClose={() => {
          setCompleted(null)
          toast.info('Session not logged.')
        }}
        onSave={saveCompletedSession}
        durationSeconds={completed?.elapsedSeconds ?? 0}
        projects={data.projects}
        defaultProjectId={data.selectedProjectId}
      />

      <ManualSessionModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onSave={(s) => run(() => data.createSession(s), 'Session logged.')}
        projects={data.projects}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={data.settings}
        onSave={(s) => run(() => data.updateSettings(s), 'Preferences saved.')}
      />

      <AuthModal isOpen={auth.status === 'anonymous'} onLogin={auth.login} onRegister={auth.register} />

      <button
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
        title="Share your feedback or suggest a feature"
        className="fixed bottom-5 right-5 z-40 flex items-center space-x-2 px-3.5 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-brand-500/80 shadow-2xl backdrop-blur transition-all hover:scale-105 active:scale-95 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <MessageSquareHeart className="w-4 h-4 text-brand-400" aria-hidden="true" />
        <span>Feedback</span>
      </button>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} userEmail={auth.user?.email} />
    </div>
  )
}
