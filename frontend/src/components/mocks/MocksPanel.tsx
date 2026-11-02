import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Crosshair, Settings2, Pencil, Trash2, AlertTriangle, CalendarCheck, FileSpreadsheet, Plus, Target } from 'lucide-react'
import type { ExamTemplate, Mistake, Mock, Project, RepeatAlert } from '../../types'
import type { MocksState } from '../../hooks/useMocks'
import { api } from '../../api/client'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { scoreMock } from '../../lib/scoring'
import { mistakesToCsv } from '../../lib/mockInsights'
import { presetFor } from '../../lib/examTemplates'
import { ExamTemplateModal } from './ExamTemplateModal'
import { MockForm } from './MockForm'
import { MistakeForm } from './MistakeForm'
import { MistakeList } from './MistakeList'
import { EMPTY_FILTER, type MistakeFilterState } from '../../lib/mistakeFilter'
import { SundayReset } from './SundayReset'
import { RepeatAlertBanner } from './RepeatAlertBanner'
import { ImportMistakesModal } from './ImportMistakesModal'

const MockInsights = lazy(() => import('./MockInsights'))

export type MocksView = 'mocks' | 'mistakes' | 'reset' | 'insights'
export type MocksAction = { kind: 'mock' | 'mistake' | 'reset'; n: number }

interface Props {
  userId: number
  projects: Project[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onCreateProject: () => void
  state: MocksState
  repeats: RepeatAlert[]
  onRepeatsChanged: () => void
  onSetTemplate: (projectId: number, t: ExamTemplate | null) => Promise<void>
  run: (fn: () => Promise<void>, success?: string) => Promise<void>
  action: MocksAction | null
  focusRepeat: RepeatAlert | null
  onFocusRepeatHandled: () => void
}

const VIEWS: { id: MocksView; label: string }[] = [
  { id: 'mocks', label: 'Mocks' },
  { id: 'mistakes', label: 'Error log' },
  { id: 'reset', label: 'Sunday Reset' },
  { id: 'insights', label: 'Insights' },
]
const VIEW_KEY = 'study_tracker_mocks_view'

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

const MocksPanel: React.FC<Props> = ({ userId, projects, selectedProjectId, onSelectProject, onCreateProject, state, repeats, onRepeatsChanged, onSetTemplate, run, action, focusRepeat, onFocusRepeatHandled }) => {
  const [view, setViewState] = useState<MocksView>(() => {
    try {
      const v = sessionStorage.getItem(VIEW_KEY) as MocksView | null
      return v && VIEWS.some((x) => x.id === v) ? v : 'mocks'
    } catch {
      return 'mocks'
    }
  })
  const setView = (v: MocksView) => {
    setViewState(v)
    try {
      sessionStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }
  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null
  const template = project?.exam_template ?? null
  const [templateOpen, setTemplateOpen] = useState(false)
  const [mockFormOpen, setMockFormOpen] = useState(false)
  const [editingMock, setEditingMock] = useState<Mock | null>(null)
  const [mistakeFormOpen, setMistakeFormOpen] = useState(false)
  const [editingMistake, setEditingMistake] = useState<Mistake | null>(null)
  const [mistakeMockId, setMistakeMockId] = useState<number | null>(null)
  const [deleteMock, setDeleteMock] = useState<Mock | null>(null)
  const [deleteMistake, setDeleteMistake] = useState<Mistake | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState<MistakeFilterState>(EMPTY_FILTER)
  const [deck, setDeck] = useState<Mistake[] | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const mocks = useMemo(() => state.mocks.filter((m) => m.project_id === project?.id), [state.mocks, project])
  const mistakes = useMemo(() => state.mistakes.filter((m) => m.project_id === project?.id), [state.mistakes, project])
  const projectRepeats = useMemo(() => repeats.filter((r) => mistakes.some((m) => m.pattern === r.pattern && m.root_cause === r.root_cause)), [repeats, mistakes])

  const openMistake = useCallback((mockId: number | null, editing: Mistake | null = null) => {
    setEditingMistake(editing)
    setMistakeMockId(mockId)
    setMistakeFormOpen(true)
  }, [])
  const openMock = useCallback((editing: Mock | null = null) => {
    setEditingMock(editing)
    setMockFormOpen(true)
  }, [])

  const loadDeck = useCallback(async () => {
    try {
      setDeck(await api.getMistakeReview())
    } catch {
      setDeck([])
    }
  }, [])
  useEffect(() => {
    if (view === 'reset') void loadDeck()
  }, [view, loadDeck])
  const projectDeck = useMemo(() => (deck ?? []).filter((m) => m.project_id === project?.id), [deck, project])

  // Command palette / shortcut requests from the app shell.
  const [handled, setHandled] = useState(action?.n ?? 0)
  useEffect(() => {
    if (!action || action.n === handled || !project) return
    setHandled(action.n)
    if (action.kind === 'mock') openMock()
    else if (action.kind === 'mistake') openMistake(mocks[0]?.id ?? null)
    else setView('reset')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, handled, project])

  // A repeat alert clicked elsewhere opens the filtered error log.
  useEffect(() => {
    if (!focusRepeat) return
    const owner = state.mistakes.find((m) => m.pattern === focusRepeat.pattern && m.root_cause === focusRepeat.root_cause)
    if (owner && owner.project_id !== project?.id) onSelectProject(owner.project_id)
    setFilter({ ...EMPTY_FILTER, pattern: focusRepeat.pattern, rootCause: focusRepeat.root_cause })
    setView('mistakes')
    onFocusRepeatHandled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRepeat, state.mistakes])

  // M logs a mock, E logs a mistake, while this tab is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !project) return
      const t = e.target as HTMLElement | null
      // Letters do not activate buttons, so a focused button (e.g. after a dialog closes) is fine.
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        openMistake(mocks[0]?.id ?? null)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        openMock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, mocks, openMistake, openMock])

  if (projects.length === 0 || !project) {
    return (
      <div className="card mx-auto mt-6 max-w-xl p-8 text-center">
        <Target className="mx-auto mb-3 h-8 w-8 text-brand-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink-50">Track mock tests and mistakes</h2>
        <p className="mt-1 text-sm text-ink-400">Create a project for your exam (for example IBPS PO Prelims) to start logging mocks.</p>
        <Button className="mt-5" onClick={onCreateProject} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Create a project</Button>
      </div>
    )
  }

  const savedMistake = () => onRepeatsChanged()

  return (
    <div className="mx-auto max-w-5xl py-4">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Mock tests</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="mocks-project">Exam track</label>
            <select id="mocks-project" className="input h-9 w-auto py-0 text-sm font-semibold" value={project.id} onChange={(e) => { onSelectProject(Number(e.target.value)); setFilter(EMPTY_FILTER) }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={() => setTemplateOpen(true)} className="focus-ring chip border-fg/[0.08] bg-fg/[0.04] text-ink-300 hover:text-ink-50">
              <Settings2 className="h-3 w-3" aria-hidden="true" />
              {template ? `${presetFor(template.key)?.label ?? 'Custom pattern'} · target ${template.target_score}` : 'Set exam pattern'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openMock()} icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}>Log mock <kbd className="ml-1 font-mono text-[10px] opacity-60">M</kbd></Button>
          <Button onClick={() => openMistake(mocks[0]?.id ?? null)} icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}>Log mistake <kbd className="ml-1 font-mono text-[10px] opacity-60">E</kbd></Button>
        </div>
      </header>

      <RepeatAlertBanner alerts={projectRepeats} onOpen={(a) => { setFilter({ ...EMPTY_FILTER, pattern: a.pattern, rootCause: a.root_cause }); setView('mistakes') }} />

      <div role="tablist" aria-label="Mock test views" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-fg/[0.06] bg-surface-950/60 p-1 [scrollbar-width:none]">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" type="button" aria-selected={view === v.id} onClick={() => setView(v.id)} className={`focus-ring whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${view === v.id ? 'bg-fg/[0.08] text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>
            {v.label}
            {v.id === 'mistakes' && mistakes.length > 0 && <span className="ml-1.5 tabular-nums text-ink-500">{mistakes.length}</span>}
          </button>
        ))}
      </div>

      {!state.loaded ? (
        <div className="space-y-2" role="status" aria-label="Loading mocks">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-3xl" />)}
        </div>
      ) : state.error && state.mocks.length === 0 && state.mistakes.length === 0 ? (
        <div role="alert" className="card p-6 text-sm text-rose-200">
          {state.error} <button type="button" className="ml-2 font-semibold underline" onClick={() => void state.refresh()}>Retry</button>
        </div>
      ) : (
        <div role="tabpanel" aria-label={VIEWS.find((v) => v.id === view)?.label}>
          {view === 'mocks' && (
            mocks.length === 0 ? (
              <div className="card p-8 text-center text-sm text-ink-400">
                <p>No mocks logged for {project.name} yet.</p>
                {!template && <p className="mt-1 text-xs">Set the exam pattern first so sections, marks and negative marking fill in for you.</p>}
                <div className="mt-4 flex justify-center gap-2">
                  {!template && <Button variant="secondary" onClick={() => setTemplateOpen(true)}>Set exam pattern</Button>}
                  <Button onClick={() => openMock()}>Log your first mock</Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {mocks.map((m) => {
                  const sc = scoreMock(m, template)
                  const flagged = sc.sections.filter((s) => s.lowAccuracy || s.highPenalty)
                  const linked = state.mistakes.filter((x) => x.mock_id === m.id).length
                  return (
                    <li key={m.id} className="card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-50">{m.name}</p>
                          <p className="mt-0.5 text-xs text-ink-500">{m.attempted_on}{m.provider && ` · ${m.provider}`}{m.percentile !== null && ` · ${m.percentile} %ile`}{m.rank !== null && ` · rank ${m.rank}`}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg tabular-nums text-ink-50">{sc.net}<span className="text-xs text-ink-500"> / {sc.maxMarks}</span></p>
                          <p className="text-[11px] text-ink-500">{sc.accuracy}% accuracy · {sc.attemptRate}% attempted</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {sc.sections.map((s) => (
                          <span key={s.name} className={`chip ${s.lowAccuracy || s.highPenalty ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-fg/[0.06] bg-fg/[0.03] text-ink-300'}`}>
                            {(s.lowAccuracy || s.highPenalty) && <AlertTriangle className="h-3 w-3" aria-label="Flagged" />}
                            {s.name} {s.net} · {s.accuracy}%
                          </span>
                        ))}
                      </div>
                      {flagged.length > 0 && (
                        <p className="mt-2 text-[11px] text-amber-200">
                          {flagged.map((s) => `${s.name}: ${[s.lowAccuracy && `accuracy ${s.accuracy}%`, s.highPenalty && `${s.penalty} lost to negatives`].filter(Boolean).join(', ')}`).join(' · ')}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="secondary" onClick={() => openMistake(m.id)} icon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />}>Log mistakes</Button>
                        {linked > 0 && <Button size="sm" variant="ghost" onClick={() => { setFilter({ ...EMPTY_FILTER, mockId: m.id }); setView('mistakes') }}>{linked} logged</Button>}
                        <span className="flex-1" />
                        <button type="button" aria-label={`Edit ${m.name}`} onClick={() => openMock(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        <button type="button" aria-label={`Delete ${m.name}`} onClick={() => setDeleteMock(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          )}

          {view === 'mistakes' && (
            <>
              <div className="mb-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)} icon={<FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />}>Import from Excel</Button>
              </div>
              <MistakeList
                mistakes={mistakes}
                mocks={mocks}
                filter={filter}
                onFilter={setFilter}
                onEdit={(m) => openMistake(m.mock_id, m)}
                onDelete={setDeleteMistake}
                onExportCsv={(visible) => saveCsv(mistakesToCsv(visible, (id) => projects.find((p) => p.id === id)?.name ?? '', (id) => state.mocks.find((m) => m.id === id)?.name ?? ''), `mistakes_${project.name.replace(/[^\w-]+/g, '_')}.csv`)}
              />
            </>
          )}

          {view === 'reset' && (
            <div className="card p-8 text-center">
              <CalendarCheck className="mx-auto mb-3 h-8 w-8 text-brand-400" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-ink-50">Sunday Reset</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">
                Every mistake from the last 7 days, plus anything marked for a concept drill or due again this week. Recall your rule, flip, then grade it.
              </p>
              {deck === null ? (
                <Skeleton className="mx-auto mt-5 h-10 w-48 rounded-2xl" />
              ) : projectDeck.length === 0 ? (
                <p className="mt-5 text-sm text-brand-300" role="status">Nothing to revise for {project.name}. Log mistakes after your next mock.</p>
              ) : (
                <Button className="mt-5" size="lg" onClick={() => setReviewing(true)}>Start: {projectDeck.length} {projectDeck.length === 1 ? 'mistake' : 'mistakes'}</Button>
              )}
            </div>
          )}

          {view === 'insights' && (
            <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
              <MockInsights mocks={mocks} mistakes={mistakes} template={template} />
            </Suspense>
          )}
        </div>
      )}

      <ExamTemplateModal isOpen={templateOpen} project={project} onClose={() => setTemplateOpen(false)} onSave={(t) => run(() => onSetTemplate(project.id, t), t ? 'Exam pattern saved.' : 'Exam pattern removed.')} />
      <MockForm
        isOpen={mockFormOpen}
        projectId={project.id}
        template={template}
        editing={editingMock}
        draftKey={`mock:${userId}:${project.id}`}
        onClose={() => setMockFormOpen(false)}
        onSave={async (input) => {
          let saved: Mock | undefined
          await run(async () => { saved = editingMock ? await state.editMock(editingMock.id, input) : await state.addMock(input) }, editingMock ? 'Mock updated.' : 'Mock logged.')
          return saved as Mock
        }}
      />
      <MistakeForm
        isOpen={mistakeFormOpen}
        projectId={project.id}
        template={template}
        mocks={mocks}
        recent={mistakes}
        editing={editingMistake}
        defaultMockId={mistakeMockId}
        draftKey={`mistake:${userId}:${project.id}`}
        onClose={() => setMistakeFormOpen(false)}
        onSave={async (input) => {
          let saved: Mistake | undefined
          await run(async () => { saved = editingMistake ? await state.editMistake(editingMistake.id, input) : await state.addMistake(input) }, editingMistake ? 'Mistake updated.' : 'Mistake logged.')
          savedMistake()
          return saved as Mistake
        }}
      />
      <ImportMistakesModal isOpen={importOpen} project={project} onClose={() => setImportOpen(false)} onImported={(n) => { void run(async () => { await state.refresh(); onRepeatsChanged() }, `Imported ${n} ${n === 1 ? 'mistake' : 'mistakes'}.`).catch(() => undefined) }} />
      <ConfirmDialog
        isOpen={deleteMock !== null}
        title="Delete this mock?"
        message={`${deleteMock?.name ?? ''} will be removed. Mistakes logged from it stay in your error log.`}
        confirmLabel="Delete mock"
        onConfirm={async () => { if (deleteMock) await run(() => state.removeMock(deleteMock.id), 'Mock deleted.').catch(() => undefined); setDeleteMock(null) }}
        onCancel={() => setDeleteMock(null)}
      />
      <ConfirmDialog
        isOpen={deleteMistake !== null}
        title="Delete this mistake?"
        message={`${deleteMistake?.pattern ?? ''} will be removed from your error log.`}
        confirmLabel="Delete mistake"
        onConfirm={async () => { if (deleteMistake) await run(() => state.removeMistake(deleteMistake.id), 'Mistake deleted.').catch(() => undefined); setDeleteMistake(null); onRepeatsChanged() }}
        onCancel={() => setDeleteMistake(null)}
      />
      {reviewing && projectDeck.length > 0 && (
        <SundayReset
          deck={projectDeck}
          onGrade={async (id, g) => {
            let out: Mistake | undefined
            await run(async () => { out = await state.gradeMistake(id, g) })
            return out as Mistake
          }}
          onClose={(t) => {
            setReviewing(false)
            void loadDeck()
            if (t.reviewed > 0) void run(async () => undefined, `Reviewed ${t.reviewed}: ${t.locked} locked in${t.drill ? `, ${t.drill} need a concept drill` : ''}.`).catch(() => undefined)
          }}
        />
      )}
    </div>
  )
}

export default MocksPanel
