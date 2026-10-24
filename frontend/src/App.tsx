import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import confetti from 'canvas-confetti'
import { Navbar, type Tab } from './components/Navbar'
import { PomodoroTimer } from './components/PomodoroTimer'
import { SessionModal } from './components/SessionModal'
import { ManualSessionModal } from './components/ManualSessionModal'
import { ProjectManager } from './components/ProjectManager'
import { HistoryTable } from './components/HistoryTable'
import { SettingsModal } from './components/SettingsModal'
import { AuthModal } from './components/AuthModal'
import { ResetPasswordModal } from './components/ResetPasswordModal'
import { useAppConfig } from './hooks/useAppConfig'
import { cleanEntryLink, parseEntryLink } from './lib/entryLink'
import { api } from './api/client'
import { FeedbackModal } from './components/FeedbackModal'
import { ToastProvider, useToast } from './components/ui/Toast'
import { ServerStatusBanner } from './components/ui/ServerStatusBanner'
import { Skeleton } from './components/ui/Skeleton'
import { TaskPanel } from './components/TaskPanel'
import { useAuth } from './hooks/useAuth'
import { useAppData } from './hooks/useAppData'
import { useTimer, type TimerFinish } from './hooks/useTimer'
import { useTasks, clearCurrentTask } from './hooks/useTasks'
import { useLocalPrefs } from './hooks/useLocalPrefs'
import { useWakeLock } from './hooks/useWakeLock'
import { useServiceWorker, clearApiCache } from './hooks/useServiceWorker'
import { notify } from './lib/notify'
import { createFavicon } from './lib/favicon'
import { clearTimer } from './lib/timerStorage'
import { formatMinutes } from './lib/time'
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

const INTERACTIVE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'])
const favicon = typeof document !== 'undefined' ? createFavicon() : null
const MODE_COLORS = { work: '#34d399', short_break: '#7dd3fc', long_break: '#c4b5fd' } as const

const AnalyticsSkeleton: React.FC = () => (
  <div className="mx-auto max-w-5xl px-4 py-8" role="status" aria-label="Loading analytics">
    <Skeleton className="mb-8 h-8 w-64" />
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-3xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Skeleton className="h-80 rounded-3xl" />
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  </div>
)

const AppShell: React.FC = () => {
  const toast = useToast()
  const auth = useAuth()
  const config = useAppConfig()
  const userId = auth.user?.id ?? null
  const [entry] = useState(() => parseEntryLink(window.location.pathname, window.location.search))
  const [resetToken, setResetToken] = useState<string | null>(() => (entry?.kind === 'reset' ? entry.token : null))

  const data = useAppData(userId)
  const taskState = useTasks(userId, data.selectedProjectId)
  const { prefs } = useLocalPrefs()

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
      const hidden = document.visibilityState === 'hidden' || !document.hasFocus()
      if (result.mode === 'work') {
        if (data.settings.sound_enabled && !result.stale) audioService.playWorkCompleteChime()
        if (!result.stale) confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#34d399', '#4cc2f5', '#f5b63d', '#8b7cf6'] })
        if (hidden || result.stale) {
          notify('Focus session done', `${formatMinutes(result.elapsedSeconds / 60)} logged${result.interruptions ? `, ${result.interruptions} interruption${result.interruptions === 1 ? '' : 's'}` : ''}. Rate it when you're back.`)
        }
        setCompleted(result)
      } else {
        if (data.settings.sound_enabled && !result.stale) audioService.playBreakCompleteChime()
        if (hidden) notify('Break over', 'Back to it when you are ready.')
      }
    },
    [data.settings.sound_enabled],
  )

  // The timer lives here so it keeps running while other tabs are open, and
  // persists to localStorage so it survives reloads.
  const timer = useTimer({ settings: data.settings, onFinish: onTimerFinish, userId, notificationsEnabled: prefs.notifications_enabled })
  const running = timer.state.status === 'running'
  useWakeLock(running)

  useEffect(() => {
    const label = timer.state.mode === 'work' ? 'Focus' : 'Break'
    document.title = running ? `${timer.formatted} · ${label} · Study Tracker` : 'Study Tracker & Pomodoro'
    if (running) favicon?.update(timer.formatted, timer.progress / 100, MODE_COLORS[timer.state.mode])
    else favicon?.restore()
  }, [timer.formatted, timer.state.mode, running, timer.progress])

  // Nothing from a previous user may linger on this device. Only an explicit
  // signed-out state clears; the initial "loading" state must leave the
  // persisted timer untouched so it can be rehydrated once the user is known.
  useEffect(() => {
    if (auth.status === 'anonymous') {
      clearTimer()
      clearCurrentTask()
      void clearApiCache()
    }
  }, [auth.status])

  // Emailed magic link: redeem it once, then clean the address bar.
  const magicHandled = useRef(false)
  useEffect(() => {
    if (!entry || magicHandled.current) return
    magicHandled.current = true
    cleanEntryLink()
    if (entry.kind !== 'magic') return
    api
      .magicSignIn(entry.token)
      .then((res) => {
        auth.applyAuth(res)
        toast.success('Signed in.')
      })
      .catch((err) => toast.error(errorMessage(err, 'This sign-in link is invalid or has expired.')))
  }, [entry, auth, toast])

  useServiceWorker({
    onNeedRefresh: (reload) => toast.action('A new version is available.', 'Reload', reload),
    onOfflineReady: () => toast.info('Ready to work offline.'),
  })

  // Keyboard shortcuts on the timer tab: Space toggles, R resets. Ignored
  // while typing, while a dialog is open, or when the timer cannot start.
  const canStart = !(timer.state.mode === 'work' && data.projects.length === 0)
  useEffect(() => {
    if (activeTab !== 'timer' || auth.status !== 'authenticated') return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (INTERACTIVE.has(target.tagName) || target.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (canStart) timer.toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        timer.reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, auth.status, canStart, timer])

  const saveCompletedSession = async (projectId: number, rating: number, notes: string, taskId: number | null) => {
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
          interruptions: completed.interruptions,
          task_id: taskId,
        }),
      'Session saved.',
    )
    setCompleted(null)
    if (taskId !== null) void taskState.refresh().catch(() => undefined)
  }

  const requestCreateProject = () => {
    setActiveTab('projects')
    setCreateProjectSignal((n) => n + 1)
  }

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4" role="status">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700 shadow-glow-lg">
          <span className="absolute inset-0 animate-breathe rounded-2xl bg-brand-400/40 blur-xl" aria-hidden="true" />
          <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-surface-950" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <span className="text-sm text-ink-500">Signing you in…</span>
      </div>
    )
  }

  const signedIn = auth.status === 'authenticated' && auth.user
  const initialLoading = Boolean(signedIn) && data.loading && !data.loaded

  return (
    <div className="flex min-h-screen flex-col">
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6" aria-busy={initialLoading}>
        {signedIn && data.error && !data.loaded && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            <span>{data.error}</span>
            <button type="button" onClick={() => void data.reload()} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        <div key={activeTab} className="animate-fade-up">
          {activeTab === 'timer' && (
            <>
              <PomodoroTimer
                timer={timer}
                projects={data.projects}
                selectedProjectId={data.selectedProjectId}
                setSelectedProjectId={data.setSelectedProjectId}
                settings={data.settings}
                onCreateProject={requestCreateProject}
                goal={data.goals?.projects.find((g) => g.project_id === data.selectedProjectId)}
              />
              {signedIn && data.selectedProjectId !== null && timer.state.mode === 'work' && (
                <div className="mx-auto max-w-2xl px-2">
                  <TaskPanel
                    projectName={data.projects.find((p) => p.id === data.selectedProjectId)?.name ?? ''}
                    tasks={taskState.tasks}
                    currentTaskId={taskState.currentTaskId}
                    onAdd={(title, estimate) => run(() => taskState.add(title, estimate))}
                    onToggle={(id, done) => run(() => taskState.toggle(id, done))}
                    onRemove={(id) => run(() => taskState.remove(id), 'Task deleted.')}
                    onMove={(id, dir) => run(() => taskState.move(id, dir))}
                    onSetCurrent={taskState.setCurrentTask}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'projects' && (
            <ProjectManager
              projects={data.projects}
              goals={data.goals?.projects}
              loading={initialLoading}
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
              loading={initialLoading}
              onDeleteSession={(id) => run(() => data.deleteSession(id), 'Entry deleted.')}
              onOpenManualModal={() => setIsManualOpen(true)}
            />
          )}

          {activeTab === 'analytics' && (
            <Suspense fallback={<AnalyticsSkeleton />}>
              {data.stats ? (
                <AnalyticsDashboard stats={data.stats} heatmap={data.heatmap} hours={data.hours} loading={data.loading} error={data.error} onRetry={() => void data.reload()} />
              ) : data.error ? (
                <AnalyticsDashboard stats={null} heatmap={[]} hours={[]} loading={false} error={data.error} onRetry={() => void data.reload()} />
              ) : (
                <AnalyticsSkeleton />
              )}
            </Suspense>
          )}
        </div>
      </main>

      <SessionModal
        isOpen={completed !== null}
        onClose={() => {
          setCompleted(null)
          toast.info('Session not logged.')
        }}
        onSave={saveCompletedSession}
        durationSeconds={completed?.elapsedSeconds ?? 0}
        interruptions={completed?.interruptions ?? 0}
        projects={data.projects}
        tasks={taskState.allTasks}
        defaultProjectId={data.selectedProjectId}
        defaultTaskId={taskState.currentTaskId}
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
        user={auth.user}
        onUserChanged={() => auth.refreshUser().catch(() => undefined)}
        onDataChanged={() => data.reload()}
        onPasswordChanged={auth.applyAuth}
        onAccountDeleted={() => {
          setIsSettingsOpen(false)
          auth.logout()
          toast.info('Your account has been deleted.')
        }}
      />

      <AuthModal
        isOpen={auth.status === 'anonymous' && resetToken === null}
        config={config}
        onLogin={auth.login}
        onRegister={auth.register}
        onGoogle={async (credential) => auth.applyAuth(await api.googleSignIn(credential))}
      />
      {resetToken !== null && (
        <ResetPasswordModal
          token={resetToken}
          onCancel={() => setResetToken(null)}
          onDone={(res) => {
            auth.applyAuth(res)
            setResetToken(null)
            toast.success('Password updated. You are signed in.')
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
        title="Share your feedback or suggest a feature"
        className="focus-ring glass fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full py-2.5 pl-3.5 pr-4 text-xs font-medium text-ink-200 shadow-card transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:text-ink-50 hover:shadow-card-hover active:translate-y-0"
      >
        <MessageSquareHeart className="h-4 w-4 text-brand-400" aria-hidden="true" />
        Feedback
      </button>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} userEmail={auth.user?.email} />
    </div>
  )
}
