import React, { useMemo, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquareHeart, Sparkles, X, Minimize2 } from 'lucide-react'
import { CommandPalette } from './components/CommandPalette'
import { ShortcutsModal } from './components/ShortcutsModal'
import { useZenMode } from './hooks/useZenMode'
import type { Command } from './lib/commands'
import type { TimerMode } from './types'
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
import { Landing } from './components/Landing'
import { useAppConfig } from './hooks/useAppConfig'
import { cleanEntryLink, parseEntryLink } from './lib/entryLink'
import { api } from './api/client'
import { FeedbackModal } from './components/FeedbackModal'
import { ToastProvider, useToast } from './components/ui/Toast'
import { ServerStatusBanner } from './components/ui/ServerStatusBanner'
import { Skeleton } from './components/ui/Skeleton'
import { TaskPanel } from './components/TaskPanel'
import { CardsPanel } from './components/CardsPanel'
import { NotesPanel } from './components/NotesPanel'
import { useCards } from './hooks/useCards'
import { useNotes } from './hooks/useNotes'
import { useFriends } from './hooks/useFriends'
import { FriendsPanel } from './components/FriendsPanel'
import { PublicProfilePage } from './components/PublicProfilePage'
import { suggestWorkDuration } from './lib/adaptive'
import { useAuth } from './hooks/useAuth'
import { useAppData } from './hooks/useAppData'
import { useTimer, type TimerFinish } from './hooks/useTimer'
import { useTasks, clearCurrentTask } from './hooks/useTasks'
import { useAppearance, useLocalPrefs } from './hooks/useLocalPrefs'
import { useWakeLock } from './hooks/useWakeLock'
import { useServiceWorker, clearApiCache } from './hooks/useServiceWorker'
import { notify } from './lib/notify'
import { createFavicon } from './lib/favicon'
import { clearTimer } from './lib/timerStorage'
import { formatMinutes } from './lib/time'
import { errorMessage } from './api/client'
import { audioService } from './services/audio'

// Recharts is heavy; load it only when the analytics tab is opened.
const TAB_ORDER: Tab[] = ['timer', 'projects', 'cards', 'notes', 'history', 'analytics', 'friends']

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
  const [authView, setAuthView] = useState<'login' | 'register' | null>(null)

  const data = useAppData(userId)
  const taskState = useTasks(userId, data.selectedProjectId)
  const cardState = useCards(userId, data.selectedProjectId)
  const noteState = useNotes(userId)
  const [reviewSignal, setReviewSignal] = useState(0)
  const [newNoteSignal, setNewNoteSignal] = useState(0)
  const { prefs, setPrefs } = useLocalPrefs()
  useAppearance()

  // Remember the tab across reloads (per browser tab, so two windows stay independent).
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    try {
      const saved = sessionStorage.getItem('study_tracker_tab') as Tab | null
      return saved && TAB_ORDER.includes(saved) ? saved : 'timer'
    } catch {
      return 'timer'
    }
  })
  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabState(tab)
    try {
      sessionStorage.setItem('study_tracker_tab', tab)
    } catch {
      /* ignore */
    }
  }, [])
  const friendState = useFriends(userId, activeTab === 'friends')
  const suggestion = useMemo(() => suggestWorkDuration(data.sessions, data.settings), [data.sessions, data.settings])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [pendingFriendToken, setPendingFriendToken] = useState<string | null>(null)
  const [profileHandle, setProfileHandle] = useState<string | null>(() => (entry?.kind === 'profile' ? entry.handle : null))
  const [createProjectSignal, setCreateProjectSignal] = useState(0)
  const [completed, setCompleted] = useState<TimerFinish | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { zen, toggle: toggleZen, exit: exitZen } = useZenMode()
  const [reviewSeen, setReviewSeen] = useState<string | null>(() => {
    try {
      return localStorage.getItem('study_tracker_review_seen')
    } catch {
      return null
    }
  })

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
    if (!entry || magicHandled.current || entry.kind === 'profile') return
    magicHandled.current = true
    cleanEntryLink()
    if (entry.kind === 'friend') {
      // Keep the token until the user is signed in, then accept it once.
      setPendingFriendToken(entry.token)
      return
    }
    if (entry.kind !== 'magic') return
    api
      .magicSignIn(entry.token)
      .then((res) => {
        auth.applyAuth(res)
        toast.success('Signed in.')
      })
      .catch((err) => toast.error(errorMessage(err, 'This sign-in link is invalid or has expired.')))
  }, [entry, auth, toast])

  // Friend invite: accept once signed in (the link may have opened the landing page first).
  useEffect(() => {
    if (!pendingFriendToken || auth.status !== 'authenticated') return
    const token = pendingFriendToken
    setPendingFriendToken(null)
    friendState
      .accept(token)
      .then((f) => {
        setActiveTab('friends')
        toast.success(f ? `You and ${f.name} are now friends.` : 'Invite accepted.')
      })
      .catch((err) => toast.error(errorMessage(err, 'This invite link is invalid or has expired.')))
  }, [pendingFriendToken, auth.status, friendState, toast, setActiveTab])

  useServiceWorker({
    onNeedRefresh: (reload) => toast.action('A new version is available.', 'Reload', reload),
    onOfflineReady: () => toast.info('Ready to work offline.'),
  })

  // Keyboard shortcuts: Ctrl/Cmd+K opens the palette anywhere; on the timer
  // tab Space toggles, R resets, F toggles zen. Ignored while typing or
  // while a dialog is open.
  const canStart = !(timer.state.mode === 'work' && data.projects.length === 0)
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (INTERACTIVE.has(target.tagName) || target.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      const key = e.key
      const tabIndex = ['1', '2', '3', '4', '5', '6', '7'].indexOf(key)
      if (tabIndex >= 0) {
        e.preventDefault()
        setActiveTab(TAB_ORDER[tabIndex])
        return
      }
      if (key === '?') {
        e.preventDefault()
        setIsShortcutsOpen(true)
        return
      }
      if (key === 'n' || key === 'N') {
        e.preventDefault()
        setIsManualOpen(true)
        return
      }
      if (key === ',') {
        e.preventDefault()
        setIsSettingsOpen(true)
        return
      }
      if (activeTab !== 'timer') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (canStart) timer.toggle()
      } else if (key === 'r' || key === 'R') {
        e.preventDefault()
        timer.reset()
      } else if (key === 's' || key === 'S') {
        e.preventDefault()
        timer.skip()
      } else if (key === 'f' || key === 'F') {
        e.preventDefault()
        toggleZen()
      } else if (key === '+' || key === '=') {
        e.preventDefault()
        timer.adjust(300)
      } else if (key === '-' || key === '_') {
        e.preventDefault()
        timer.adjust(-300)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, auth.status, canStart, timer, toggleZen, setActiveTab])

  const markReviewSeen = useCallback(() => {
    const key = data.review?.week_start ?? null
    setReviewSeen(key)
    try {
      if (key) localStorage.setItem('study_tracker_review_seen', key)
    } catch {
      /* ignore */
    }
  }, [data.review])
  const reviewReady = Boolean(data.review && data.review.minutes > 0 && data.review.week_start !== reviewSeen)

  const commands: Command[] = [
    { id: 'start', label: timer.state.status === 'running' ? 'Pause timer' : timer.state.status === 'paused' ? 'Resume timer' : 'Start timer', hint: 'Space', group: 'Timer', run: () => { setActiveTab('timer'); if (canStart) timer.toggle() } },
    { id: 'reset', label: 'Reset timer', hint: 'R', group: 'Timer', run: timer.reset },
    { id: 'skip', label: 'Skip to next interval', hint: 'S', group: 'Timer', run: timer.skip },
    ...(['work', 'short_break', 'long_break'] as TimerMode[]).map((m) => ({
      id: `mode-${m}`, label: m === 'work' ? 'Switch to focus' : m === 'short_break' ? 'Switch to short break' : 'Switch to long break', group: 'Timer' as const, run: () => { setActiveTab('timer'); timer.switchMode(m) },
    })),
    { id: 'zen', label: zen ? 'Exit zen mode' : 'Enter zen mode', hint: 'F', keywords: 'fullscreen focus distraction', group: 'Timer', run: () => { setActiveTab('timer'); toggleZen() } },
    { id: 'nav-timer', label: 'Go to focus', hint: '1', group: 'Navigate', run: () => setActiveTab('timer') },
    { id: 'nav-projects', label: 'Go to projects', hint: '2', group: 'Navigate', run: () => setActiveTab('projects') },
    { id: 'nav-cards', label: 'Go to cards', hint: '3', keywords: 'flashcards', group: 'Navigate', run: () => setActiveTab('cards') },
    { id: 'nav-notes', label: 'Go to notes', hint: '4', group: 'Navigate', run: () => setActiveTab('notes') },
    { id: 'nav-history', label: 'Go to history', hint: '5', group: 'Navigate', run: () => setActiveTab('history') },
    { id: 'nav-analytics', label: 'Go to analytics', hint: '6', keywords: 'stats review heatmap', group: 'Navigate', run: () => setActiveTab('analytics') },
    { id: 'nav-friends', label: 'Go to friends', hint: '7', keywords: 'leaderboard invite study together', group: 'Navigate', run: () => setActiveTab('friends') },
    ...data.projects.map((p) => ({ id: `project-${p.id}`, label: `Focus on ${p.name}`, keywords: 'project select', group: 'Projects' as const, run: () => { data.setSelectedProjectId(p.id); setActiveTab('timer') } })),
    { id: 'new-project', label: 'New project', group: 'Projects', run: requestCreateProject },
    { id: 'review', label: cardState.stats.due > 0 ? `Review ${cardState.stats.due} due cards` : 'Open flashcards', keywords: 'flashcards srs study', group: 'Actions', run: () => { setActiveTab('cards'); setReviewSignal((n) => n + 1) } },
    { id: 'new-note', label: 'New note', keywords: 'write markdown', group: 'Actions', run: () => { setActiveTab('notes'); setNewNoteSignal((n) => n + 1) } },
    { id: 'log', label: 'Log a past session', hint: 'N', keywords: 'manual entry', group: 'Actions', run: () => setIsManualOpen(true) },
    { id: 'settings', label: 'Open settings', hint: ',', keywords: 'preferences calendar import account', group: 'Actions', run: () => setIsSettingsOpen(true) },
    { id: 'shortcuts', label: 'Keyboard shortcuts', hint: '?', keywords: 'help keys', group: 'Actions', run: () => setIsShortcutsOpen(true) },
    { id: 'export-csv', label: 'Export sessions as CSV', keywords: 'spreadsheet download excel', group: 'Actions', run: () => void run(() => api.exportSessionsCsv(), 'CSV downloaded.') },
    { id: 'theme', label: prefs.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme', keywords: 'appearance mode', group: 'Actions', run: () => setPrefs({ theme: prefs.theme === 'light' ? 'dark' : 'light' }) },
    { id: 'feedback', label: 'Send feedback', group: 'Actions', run: () => setIsFeedbackOpen(true) },
    { id: 'logout', label: 'Sign out', group: 'Actions', run: auth.logout },
  ]

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

  function requestCreateProject() {
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

  if (profileHandle) {
    return (
      <div className="min-h-screen">
        <PublicProfilePage
          handle={profileHandle}
          onHome={() => {
            cleanEntryLink()
            setProfileHandle(null)
          }}
        />
      </div>
    )
  }

  const signedIn = auth.status === 'authenticated' && auth.user
  const initialLoading = Boolean(signedIn) && data.loading && !data.loaded

  return (
    <div className={`flex min-h-screen flex-col ${zen ? 'zen' : ''}`}>
      {!zen && <ServerStatusBanner authStatus={auth.status} onRetry={() => void auth.retry()} />}
      {!zen && (
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
      )}
      {zen && (
        <button type="button" onClick={exitZen} className="focus-ring glass fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-ink-300 hover:text-ink-50" aria-label="Exit zen mode">
          <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> Exit zen
        </button>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6" aria-busy={initialLoading}>
        {signedIn && data.error && !data.loaded && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            <span>{data.error}</span>
            <button type="button" onClick={() => void data.reload()} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {auth.status === 'anonymous' && resetToken === null && (
          <Landing onSignIn={() => setAuthView('login')} onRegister={() => setAuthView('register')} />
        )}

        <div key={activeTab} className={`animate-fade-up ${auth.status === 'anonymous' ? 'hidden' : ''}`}>
          {activeTab === 'timer' && (
            <>
              {reviewReady && !zen && (
                <div className="mx-auto mb-2 flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/[0.07] px-4 py-2.5 text-xs text-ink-200 animate-fade-up" role="status">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                    Your weekly review is ready: {formatMinutes(data.review?.minutes ?? 0)} last week.
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => { markReviewSeen(); setActiveTab('analytics') }} className="focus-ring rounded-lg px-2 py-1 font-semibold text-brand-300 hover:bg-brand-500/10">Read it</button>
                    <button type="button" onClick={markReviewSeen} aria-label="Dismiss" className="focus-ring rounded-lg p-1 text-ink-500 hover:text-ink-100"><X className="h-3.5 w-3.5" /></button>
                  </span>
                </div>
              )}
              <PomodoroTimer
                timer={timer}
                projects={data.projects}
                selectedProjectId={data.selectedProjectId}
                setSelectedProjectId={data.setSelectedProjectId}
                settings={data.settings}
                onCreateProject={requestCreateProject}
                goal={data.goals?.projects.find((g) => g.project_id === data.selectedProjectId)}
                suggestion={suggestion}
                onApplySuggestion={(minutes) => void run(() => data.updateSettings({ ...data.settings, work_duration: minutes }), `Focus sessions are now ${minutes} minutes.`)}
              />
              {signedIn && !zen && data.selectedProjectId !== null && timer.state.mode === 'work' && (
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

          {activeTab === 'cards' && (
            <CardsPanel
              projects={data.projects}
              selectedProjectId={data.selectedProjectId}
              onSelectProject={data.setSelectedProjectId}
              cards={cardState.cards}
              stats={cardState.stats}
              loading={cardState.loading}
              startReviewSignal={reviewSignal}
              onAdd={(c) => run(() => cardState.add(c), 'Card added.')}
              onEdit={(id, c) => run(() => cardState.edit(id, c), 'Card saved.')}
              onArchive={(id, a) => run(() => cardState.archive(id, a))}
              onRemove={(id) => run(() => cardState.remove(id), 'Card deleted.')}
              onReview={async (id, rating) => {
                try {
                  return await cardState.review(id, rating)
                } catch (err) {
                  toast.error(errorMessage(err))
                  throw err
                }
              }}
              onReviewFinished={(summary) => {
                void cardState.refresh().catch(() => undefined)
                if (summary.reviewed === 0) return
                toast.success(`Reviewed ${summary.reviewed} card${summary.reviewed === 1 ? '' : 's'}${summary.again ? `, ${summary.again} to repeat` : ''}.`)
                // Reviews of a minute or more count as study time on the project.
                if (summary.seconds >= 60 && data.selectedProjectId !== null) {
                  const end = new Date()
                  void data
                    .createSession({
                      project_id: data.selectedProjectId,
                      start_time: new Date(end.getTime() - summary.seconds * 1000).toISOString(),
                      end_time: end.toISOString(),
                      duration_seconds: summary.seconds,
                      session_type: 'custom',
                      focus_rating: 5,
                      notes: `Reviewed ${summary.reviewed} flashcards`,
                    })
                    .catch(() => undefined)
                }
              }}
            />
          )}

          {activeTab === 'notes' && (
            <NotesPanel
              projects={data.projects}
              notes={noteState.notes}
              loading={noteState.loading}
              newNoteSignal={newNoteSignal}
              onAdd={async (n) => { const created = await noteState.add(n).catch((err) => { toast.error(errorMessage(err)); throw err }); toast.success('Note created.'); return created }}
              onEdit={async (id, n) => noteState.edit(id, n).catch((err) => { toast.error(errorMessage(err)); throw err })}
              onRemove={(id) => run(() => noteState.remove(id), 'Note deleted.')}
            />
          )}

          {activeTab === 'friends' && auth.user && (
            <FriendsPanel
              user={auth.user}
              stats={data.stats}
              friends={friendState.friends}
              loaded={friendState.loaded}
              error={friendState.error}
              onInvite={friendState.invite}
              onRemove={friendState.remove}
              onRefresh={friendState.refresh}
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
                <AnalyticsDashboard stats={data.stats} heatmap={data.heatmap} hours={data.hours} review={data.review} streak={data.streak} milestones={data.milestones} projects={data.projects} onFreeze={() => run(() => data.freezeStreak(), 'Yesterday is frozen. Streak saved.')} loading={data.loading} error={data.error} onRetry={() => void data.reload()} appUrl={config.app_url} />
              ) : data.error ? (
                <AnalyticsDashboard stats={null} heatmap={[]} hours={[]} review={null} streak={null} milestones={[]} projects={[]} onFreeze={async () => undefined} loading={false} error={data.error} onRetry={() => void data.reload()} appUrl={config.app_url} />
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
        vapidPublicKey={config.vapid_public_key ?? ''}
        appUrl={config.app_url}
        onAccountDeleted={() => {
          setIsSettingsOpen(false)
          auth.logout()
          toast.info('Your account has been deleted.')
        }}
      />

      <AuthModal
        isOpen={auth.status === 'anonymous' && resetToken === null && authView !== null}
        initialView={authView ?? 'login'}
        onClose={() => setAuthView(null)}
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

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {!zen && (
      <button
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
        title="Share your feedback or suggest a feature"
        className="focus-ring glass fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full py-2.5 pl-3.5 pr-4 text-xs font-medium text-ink-200 shadow-card transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:text-ink-50 hover:shadow-card-hover active:translate-y-0"
      >
        <MessageSquareHeart className="h-4 w-4 text-brand-400" aria-hidden="true" />
        Feedback
      </button>
      )}

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} userEmail={auth.user?.email} />
    </div>
  )
}
