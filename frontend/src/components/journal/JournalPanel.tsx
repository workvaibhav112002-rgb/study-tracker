import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Crosshair, Plus, Settings2, Target, FileSpreadsheet, ClipboardCheck } from 'lucide-react'
import type { CardInput, ExamTemplate, JournalConfig, Mistake, MistakeGrade, Mock, PatternAlert, Project } from '../../types'
import type { JournalState } from '../../hooks/useJournal'
import { api } from '../../api/client'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cardFromMistake, describeTags, effectiveConfig, mistakesToCsv, optionLabel, categoryOf, tagValues } from '../../lib/journal'
import { detectPatterns, describeAlert } from '../../lib/patterns'
import { EMPTY_JOURNAL_FILTER, type JournalFilter } from '../../lib/journalFilter'
import { MistakeForm } from './MistakeForm'
import { JournalList } from './JournalList'
import { ReviewDeck } from './ReviewDeck'
import { PatternBanner } from './PatternBanner'
import { SetupEditor, type Retag } from './SetupEditor'
import { ImportMistakesModal } from './ImportMistakesModal'
import { TestsView } from './TestsView'

const MistakeDashboard = lazy(() => import('./MistakeDashboard'))
const PatternsView = lazy(() => import('./PatternsView'))

export type JournalView = 'dashboard' | 'journal' | 'patterns' | 'review' | 'tests'
export type JournalAction = { kind: 'mistake' | 'test' | 'review' | 'customize'; n: number }

interface Props {
  userId: number
  projects: Project[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onCreateProject: () => void
  state: JournalState
  onAlertsChanged: () => void
  onSetTemplate: (projectId: number, t: ExamTemplate | null) => Promise<void>
  onSetProjectJournal: (projectId: number, c: JournalConfig | null) => Promise<void>
  onCreateCard: (c: CardInput) => Promise<unknown>
  run: (fn: () => Promise<void>, success?: string) => Promise<void>
  action: JournalAction | null
  focusAlert: PatternAlert | null
  onFocusAlertHandled: () => void
}

const VIEW_KEY = 'study_tracker_journal_view'

function saveCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Deck = { title: string; mistakes: Mistake[] }

const JournalPanel: React.FC<Props> = ({ userId, projects, selectedProjectId, onSelectProject, onCreateProject, state, onAlertsChanged, onSetTemplate, onSetProjectJournal, onCreateCard, run, action, focusAlert, onFocusAlertHandled }) => {
  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null
  const config = effectiveConfig(project, state.userConfig)
  const [view, setViewState] = useState<JournalView>(() => {
    try {
      const v = sessionStorage.getItem(VIEW_KEY) as JournalView | null
      return v && ['dashboard', 'journal', 'patterns', 'review', 'tests'].includes(v) ? v : 'dashboard'
    } catch {
      return 'dashboard'
    }
  })
  const setView = useCallback((v: JournalView) => {
    setViewState(v)
    try {
      sessionStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }, [])
  const shownView: JournalView = view === 'tests' && !config.tests_enabled ? 'dashboard' : view

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Mistake | null>(null)
  const [formTestId, setFormTestId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Mistake | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState<JournalFilter>(EMPTY_JOURNAL_FILTER)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [weekly, setWeekly] = useState<Mistake[] | null>(null)
  const [testRequested, setTestRequested] = useState(false)
  const clearTestRequest = useCallback(() => setTestRequested(false), [])

  const tests = useMemo(() => state.mocks.filter((m) => m.project_id === project?.id), [state.mocks, project])
  const mistakes = useMemo(() => state.mistakes.filter((m) => m.project_id === project?.id), [state.mistakes, project])
  const projectAlerts = useMemo(() => (project ? detectPatterns(project.id, mistakes, config) : []), [project, mistakes, config])

  const loadWeekly = useCallback(async () => {
    try {
      setWeekly(await api.getMistakeReview())
    } catch {
      setWeekly([])
    }
  }, [])
  useEffect(() => {
    if (shownView === 'review' || shownView === 'dashboard') void loadWeekly()
  }, [shownView, loadWeekly, state.mistakes])
  const weeklyForProject = useMemo(() => (weekly ?? []).filter((m) => m.project_id === project?.id), [weekly, project])

  const openMistake = useCallback((testId: number | null, edit: Mistake | null = null) => {
    setEditing(edit)
    setFormTestId(testId)
    setFormOpen(true)
  }, [])

  const reviewTag = useCallback(
    async (f: { category: string; value: string }) => {
      const label = optionLabel(categoryOf(config, f.category), f.value)
      try {
        const list = (await api.getMistakeReview(f)).filter((m) => m.project_id === project?.id)
        if (list.length === 0) {
          await run(async () => undefined, `Everything for ${label} is already locked in.`)
          return
        }
        setDeck({ title: `Review: ${label}`, mistakes: list })
      } catch {
        await run(async () => { throw new Error('Could not load the review deck.') }).catch(() => undefined)
      }
    },
    [config, project, run],
  )

  const makeCards = useCallback(
    async (list: Mistake[]) => {
      if (!project) return
      const usable = list.filter((m) => m.question.trim() || m.rule.trim()).slice(0, 20)
      if (usable.length === 0) {
        await run(async () => { throw new Error('These mistakes have no text to turn into flashcards yet.') }).catch(() => undefined)
        return
      }
      await run(async () => {
        for (const m of usable) await onCreateCard(cardFromMistake(config, m, project.id))
      }, `Made ${usable.length} flashcard${usable.length === 1 ? '' : 's'} in Cards.`).catch(() => undefined)
    },
    [project, config, onCreateCard, run],
  )

  // Command palette / shortcut requests from the app shell.
  const [handled, setHandled] = useState(action?.n ?? 0)
  useEffect(() => {
    if (!action || action.n === handled || !project) return
    setHandled(action.n)
    if (action.kind === 'mistake') openMistake(tests[0]?.id ?? null)
    else if (action.kind === 'test') {
      if (config.tests_enabled) {
        setView('tests')
        setTestRequested(true)
      } else setSetupOpen(true)
    } else if (action.kind === 'review') setView('review')
    else setSetupOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, handled, project])

  // A pattern alert clicked elsewhere opens the matching mistakes.
  useEffect(() => {
    if (!focusAlert) return
    if (focusAlert.project_id !== project?.id) onSelectProject(focusAlert.project_id)
    const cfg = effectiveConfig(projects.find((p) => p.id === focusAlert.project_id), state.userConfig)
    setFilter({ ...EMPTY_JOURNAL_FILTER, ids: focusAlert.mistake_ids, idsLabel: describeAlert(cfg, focusAlert) })
    setView('journal')
    onFocusAlertHandled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAlert])

  // E logs a mistake, T logs a test, while this tab is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !project) return
      const t = e.target as HTMLElement | null
      // Letters do not activate buttons, so a focused button (e.g. after a dialog closes) is fine.
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        openMistake(tests[0]?.id ?? null)
      } else if ((e.key === 't' || e.key === 'T') && config.tests_enabled) {
        e.preventDefault()
        setView('tests')
        setTestRequested(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, tests, config.tests_enabled, openMistake, setView])

  if (projects.length === 0 || !project) {
    return (
      <div className="card mx-auto mt-6 max-w-xl p-8 text-center">
        <Target className="mx-auto mb-3 h-8 w-8 text-brand-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink-50">Learn from every mistake</h2>
        <p className="mt-1 text-sm text-ink-400">Create a project for any area of work, then log mistakes against it. The app finds what keeps going wrong.</p>
        <Button className="mt-5" onClick={onCreateProject} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Create a project</Button>
      </div>
    )
  }

  const views: { id: JournalView; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'journal', label: 'Journal' },
    { id: 'patterns', label: 'Patterns' },
    { id: 'review', label: 'Review' },
    ...(config.tests_enabled ? [{ id: 'tests' as const, label: 'Tests' }] : []),
  ]
  const seeTag = (f: { category: string; value: string }) => {
    setFilter({ ...EMPTY_JOURNAL_FILTER, tags: { [f.category]: f.value } })
    setView('journal')
  }

  const saveSetup = async (scope: 'default' | 'project', cfg: JournalConfig, retags: Retag[]) => {
    await run(async () => {
      if (scope === 'default') {
        await state.saveUserConfig(cfg)
        if (project.journal_config) await onSetProjectJournal(project.id, null)
      } else await onSetProjectJournal(project.id, cfg)
      for (const r of retags) await state.retag({ project_id: scope === 'project' ? project.id : undefined, category: r.category, from: r.from, to: r.to })
      onAlertsChanged()
    }, scope === 'default' ? 'Saved as your default setup.' : `Saved for ${project.name}.`)
  }

  return (
    <div className="mx-auto max-w-5xl py-4">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Mistake Lab</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="journal-project">Project</label>
            <select id="journal-project" className="input h-9 w-auto py-0 text-sm font-semibold" value={project.id} onChange={(e) => { onSelectProject(Number(e.target.value)); setFilter(EMPTY_JOURNAL_FILTER) }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={() => setSetupOpen(true)} className="focus-ring chip border-fg/[0.08] bg-fg/[0.04] text-ink-300 hover:text-ink-50">
              <Settings2 className="h-3 w-3" aria-hidden="true" />
              Customize{project.journal_config ? ` (own setup)` : ''}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.tests_enabled && <Button variant="secondary" onClick={() => { setView('tests'); setTestRequested(true) }} icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}>Log test <kbd className="ml-1 font-mono text-[10px] opacity-60">T</kbd></Button>}
          <Button onClick={() => openMistake(tests[0]?.id ?? null)} icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}>Log mistake <kbd className="ml-1 font-mono text-[10px] opacity-60">E</kbd></Button>
        </div>
      </header>

      <PatternBanner
        alerts={projectAlerts}
        configFor={() => config}
        onOpen={(a) => { setFilter({ ...EMPTY_JOURNAL_FILTER, ids: a.mistake_ids, idsLabel: describeAlert(config, a) }); setView('journal') }}
      />

      <div role="tablist" aria-label="Journal views" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-fg/[0.06] bg-surface-950/60 p-1 [scrollbar-width:none]">
        {views.map((v) => (
          <button key={v.id} role="tab" type="button" aria-selected={shownView === v.id} onClick={() => setView(v.id)} className={`focus-ring whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${shownView === v.id ? 'bg-fg/[0.08] text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>
            {v.label}
            {v.id === 'journal' && mistakes.length > 0 && <span className="ml-1.5 tabular-nums text-ink-500">{mistakes.length}</span>}
            {v.id === 'review' && weeklyForProject.length > 0 && <span className="ml-1.5 tabular-nums text-brand-300">{weeklyForProject.length}</span>}
          </button>
        ))}
      </div>

      {!state.loaded ? (
        <div className="space-y-2" role="status" aria-label="Loading your mistakes">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-3xl" />)}
        </div>
      ) : state.error && state.mistakes.length === 0 ? (
        <div role="alert" className="card p-6 text-sm text-rose-200">
          {state.error} <button type="button" className="ml-2 font-semibold underline" onClick={() => void state.refresh()}>Retry</button>
        </div>
      ) : (
        <div role="tabpanel" aria-label={views.find((v) => v.id === shownView)?.label}>
          {shownView === 'dashboard' && (
            <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
              <MistakeDashboard
                config={config}
                mistakes={mistakes}
                alerts={projectAlerts}
                reviewDue={weekly === null ? null : weeklyForProject.length}
                onSeeMistakes={seeTag}
                onReview={(f) => (f ? void reviewTag(f) : setView('review'))}
                onMakeCards={(f) => void makeCards(mistakes.filter((m) => m.status !== 'locked_in' && tagValues(m, f.category).includes(f.value)))}
                onLog={() => openMistake(tests[0]?.id ?? null)}
              />
            </Suspense>
          )}

          {shownView === 'journal' && (
            <>
              <div className="mb-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)} icon={<FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />}>Import from Excel</Button>
              </div>
              <JournalList
                config={config}
                mistakes={mistakes}
                tests={tests}
                filter={filter}
                onFilter={setFilter}
                onEdit={(m) => openMistake(m.mock_id, m)}
                onDelete={setDeleting}
                onMakeCard={(m) => void makeCards([m])}
                onExportCsv={(visible) => saveCsv(mistakesToCsv(config, visible, (id) => projects.find((p) => p.id === id)?.name ?? '', (id) => state.mocks.find((m) => m.id === id)?.name ?? ''), `mistakes_${project.name.replace(/[^\w-]+/g, '_')}.csv`)}
              />
            </>
          )}

          {shownView === 'patterns' && (
            <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
              <PatternsView
                config={config}
                mistakes={mistakes}
                alerts={projectAlerts}
                onSeeIds={(ids, label) => { setFilter({ ...EMPTY_JOURNAL_FILTER, ids, idsLabel: label }); setView('journal') }}
                onSeeCell={(tags) => { setFilter({ ...EMPTY_JOURNAL_FILTER, tags }); setView('journal') }}
                onReviewAlert={(a) => setDeck({ title: `Review: ${describeAlert(config, a)}`, mistakes: mistakes.filter((m) => a.mistake_ids.includes(m.id)) })}
              />
            </Suspense>
          )}

          {shownView === 'review' && (
            <div className="card p-8 text-center">
              <h2 className="text-lg font-semibold text-ink-50">Weekly review</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">Mistakes from the last 7 days, plus anything marked for practice or due again. Recall the lesson, flip, then grade it.</p>
              {weekly === null ? (
                <Skeleton className="mx-auto mt-5 h-10 w-48 rounded-2xl" />
              ) : weeklyForProject.length === 0 ? (
                <p className="mt-5 text-sm text-brand-300" role="status">Nothing to review for {project.name} right now.</p>
              ) : (
                <Button className="mt-5" size="lg" onClick={() => setDeck({ title: 'Weekly review', mistakes: weeklyForProject })}>Start: {weeklyForProject.length} {weeklyForProject.length === 1 ? 'mistake' : 'mistakes'}</Button>
              )}
            </div>
          )}

          {shownView === 'tests' && (
            <TestsView
              userId={userId}
              project={project}
              config={config}
              tests={tests}
              mistakes={mistakes}
              run={run}
              openRequested={testRequested}
              onOpenHandled={clearTestRequest}
              onSaveTest={async (id, input) => {
                let saved: Mock | undefined
                await run(async () => { saved = id ? await state.editMock(id, input) : await state.addMock(input) }, id ? 'Test updated.' : 'Test logged.')
                return saved as Mock
              }}
              onDeleteTest={state.removeMock}
              onSetTemplate={onSetTemplate}
              onLogMistakes={(id) => openMistake(id)}
              onSeeMistakes={(id) => { setFilter({ ...EMPTY_JOURNAL_FILTER, testId: id }); setView('journal') }}
            />
          )}
        </div>
      )}

      <MistakeForm
        isOpen={formOpen}
        projectId={project.id}
        config={config}
        tests={tests}
        recent={mistakes}
        editing={editing}
        defaultTestId={formTestId}
        draftKey={`mistake:${userId}:${project.id}`}
        onClose={() => setFormOpen(false)}
        onSave={async (input) => {
          let saved: Mistake | undefined
          await run(async () => { saved = editing ? await state.editMistake(editing.id, input) : await state.addMistake(input) }, editing ? 'Mistake updated.' : 'Mistake logged.')
          onAlertsChanged()
          return saved as Mistake
        }}
      />
      <SetupEditor
        isOpen={setupOpen}
        project={project}
        current={config}
        projectHasOwn={Boolean(project.journal_config)}
        mistakes={mistakes}
        onClose={() => setSetupOpen(false)}
        onSave={saveSetup}
        onUseDefault={() => run(() => onSetProjectJournal(project.id, null), `${project.name} now uses your default setup.`)}
      />
      <ImportMistakesModal isOpen={importOpen} project={project} onClose={() => setImportOpen(false)} onImported={(n) => { void run(async () => { await state.refresh(); onAlertsChanged() }, `Imported ${n} ${n === 1 ? 'mistake' : 'mistakes'}.`).catch(() => undefined) }} />
      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this mistake?"
        message={deleting ? `${describeTags(config, deleting) || 'This mistake'} will be removed from your journal.` : ''}
        confirmLabel="Delete mistake"
        onConfirm={async () => { if (deleting) await run(() => state.removeMistake(deleting.id), 'Mistake deleted.').catch(() => undefined); setDeleting(null); onAlertsChanged() }}
        onCancel={() => setDeleting(null)}
      />
      {deck && deck.mistakes.length > 0 && (
        <ReviewDeck
          title={deck.title}
          deck={deck.mistakes}
          config={config}
          onGrade={async (id, g: MistakeGrade) => {
            let out: Mistake | undefined
            await run(async () => { out = await state.gradeMistake(id, g) })
            return out as Mistake
          }}
          onMakeCard={(m) => void makeCards([m])}
          onClose={(t) => {
            setDeck(null)
            void loadWeekly()
            if (t.reviewed > 0) void run(async () => undefined, `Reviewed ${t.reviewed}: ${t.locked} locked in${t.drill ? `, ${t.drill} need more practice` : ''}.`).catch(() => undefined)
          }}
        />
      )}
    </div>
  )
}

export default JournalPanel
