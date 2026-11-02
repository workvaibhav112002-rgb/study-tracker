import React, { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { AlertTriangle, ClipboardCheck, Crosshair, Pencil, Settings2, Trash2 } from 'lucide-react'
import type { ExamTemplate, JournalConfig, Mistake, Mock, MockInput, Project } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ChartTooltip } from '../ui/ChartTooltip'
import { scoreMock } from '../../lib/scoring'
import { clearsTarget, cutoffTrajectory, marksLeakage } from '../../lib/mockInsights'
import { presetFor } from '../../lib/examTemplates'
import { PALETTE, categoryOf, optionColor, optionLabel } from '../../lib/journal'
import { ExamTemplateModal } from './ExamTemplateModal'
import { MockForm } from './MockForm'
import { DataTable, Legend, Panel } from './ChartBits'
import { AXIS, GRID, SURFACE } from '../../lib/chartTheme'

interface Props {
  userId: number
  project: Project
  config: JournalConfig
  tests: Mock[]
  mistakes: Mistake[]
  run: (fn: () => Promise<void>, success?: string) => Promise<void>
  onSaveTest: (id: number | null, input: MockInput) => Promise<Mock>
  onDeleteTest: (id: number) => Promise<void>
  onSetTemplate: (projectId: number, t: ExamTemplate | null) => Promise<void>
  onLogMistakes: (testId: number) => void
  onSeeMistakes: (testId: number) => void
  openRequested: boolean
  onOpenHandled: () => void
}

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** Optional test-score tracking: log tests by section, see the trend against a target. */
export const TestsView: React.FC<Props> = ({ userId, project, config, tests, mistakes, run, onSaveTest, onDeleteTest, onSetTemplate, onLogMistakes, onSeeMistakes, openRequested, onOpenHandled }) => {
  const template = project.exam_template ?? null
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Mock | null>(null)
  const [formatOpen, setFormatOpen] = useState(false)
  const [deleting, setDeleting] = useState<Mock | null>(null)
  // "Log test" from the header, the T key or the command palette.
  useEffect(() => {
    if (!openRequested) return
    onOpenHandled()
    setEditing(null)
    setFormOpen(true)
  }, [openRequested, onOpenHandled])

  const target = template?.target_score ?? 0
  const trend = useMemo(() => cutoffTrajectory(tests, template).map((p) => ({ ...p, label: shortDate(p.date) })), [tests, template])
  const leak = useMemo(() => marksLeakage(tests, mistakes, template).map((p) => ({ ...p, label: shortDate(p.date), ...p.lost })), [tests, mistakes, template])
  const kindCat = categoryOf(config, 'mistake_type')
  const lostKeys = useMemo(() => {
    const present = new Set(leak.flatMap((p) => Object.keys(p.lost)))
    const ordered = (kindCat?.options ?? []).filter((o) => present.has(o.key)).map((o) => o.key)
    return [...ordered, ...[...present].filter((k) => !ordered.includes(k))]
  }, [leak, kindCat])
  const clears = clearsTarget(trend, target)
  const latest = trend[trend.length - 1]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setFormatOpen(true)} className="focus-ring chip border-fg/[0.08] bg-fg/[0.04] text-ink-300 hover:text-ink-50">
          <Settings2 className="h-3 w-3" aria-hidden="true" />
          {template ? `${presetFor(template.key)?.label ?? 'Custom format'}${target ? ` · target ${target}` : ''}` : 'Set test format'}
        </button>
        <Button variant="secondary" onClick={() => { setEditing(null); setFormOpen(true) }} icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}>Log test</Button>
      </div>

      {tests.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-400">
          <p>No tests logged for {project.name} yet.</p>
          {!template && <p className="mt-1 text-xs">Set the test format first so sections and marking fill in for you.</p>}
        </div>
      ) : (
        <>
          <Panel title="Score trend" testId="score-trend" subtitle={target > 0 && latest ? <>4-week average <strong className="tabular-nums text-ink-200">{latest.rolling}</strong> against a target of {target}: <span className={clears ? 'text-brand-300' : 'text-rose-300'}>{clears ? 'on target' : 'below target'}</span></> : 'Set a target score in the test format to draw the target line.'}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as (typeof trend)[number]
                    return <ChartTooltip title={`${d.name} · ${d.date}`} value={`Score ${d.net} · 4-week average ${d.rolling}`} />
                  }} />
                  {target > 0 && <ReferenceLine y={target} stroke="rgb(var(--ink-400))" strokeDasharray="2 4" label={{ value: `Target ${target}`, fill: 'rgb(var(--ink-300))', fontSize: 11, position: 'insideTopRight' }} />}
                  <Line type="monotone" dataKey="net" stroke={PALETTE[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: SURFACE }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="rolling" stroke={PALETTE[1]} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Legend items={[{ label: 'Score', color: PALETTE[0] }, { label: '4-week average', color: PALETTE[1], dashed: true }]} />
            <DataTable caption="Test scores" head={['Test', 'Date', 'Score', '4-week average']} rows={trend.map((p) => [p.name, p.date, p.net, p.rolling])} />
          </Panel>

          {lostKeys.length > 0 && (
            <Panel title="Marks lost by mistake type" testId="marks-lost" subtitle="From mistakes linked to each test. Each counts as a wrong answer with its negative marking.">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leak} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%" maxBarSize={48}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgb(var(--fg) / 0.05)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as (typeof leak)[number]
                      return <ChartTooltip title={d.name} value={lostKeys.filter((k) => d.lost[k]).map((k) => `${optionLabel(kindCat, k)} ${d.lost[k]}`).join(' · ')} />
                    }} />
                    {lostKeys.map((k, i) => (
                      <Bar key={k} dataKey={k} stackId="l" fill={optionColor(kindCat, k)} stroke={SURFACE} strokeWidth={2} radius={i === lostKeys.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend items={lostKeys.map((k) => ({ label: optionLabel(kindCat, k), color: optionColor(kindCat, k) }))} />
              <DataTable caption="Marks lost per test" head={['Test', ...lostKeys.map((k) => optionLabel(kindCat, k))]} rows={leak.map((p) => [p.name, ...lostKeys.map((k) => p.lost[k] ?? 0)])} />
            </Panel>
          )}

          <ul className="space-y-2">
            {tests.map((m) => {
              const sc = scoreMock(m, template)
              const flagged = sc.sections.filter((s) => s.lowAccuracy || s.highPenalty)
              const linked = mistakes.filter((x) => x.mock_id === m.id).length
              return (
                <li key={m.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-50">{m.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{m.attempted_on}{m.provider && ` · ${m.provider}`}{m.percentile !== null && ` · ${m.percentile} percentile`}{m.rank !== null && ` · rank ${m.rank}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg tabular-nums text-ink-50">{sc.net}<span className="text-xs text-ink-500"> / {sc.maxMarks}</span></p>
                      <p className="text-[11px] text-ink-500">{sc.accuracy}% accuracy · {sc.attemptRate}% attempted</p>
                    </div>
                  </div>
                  {sc.sections.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sc.sections.map((s) => (
                        <span key={s.name} className={`chip ${s.lowAccuracy || s.highPenalty ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-fg/[0.06] bg-fg/[0.03] text-ink-300'}`}>
                          {(s.lowAccuracy || s.highPenalty) && <AlertTriangle className="h-3 w-3" aria-label="Flagged" />}
                          {s.name} {s.net} · {s.accuracy}%
                        </span>
                      ))}
                    </div>
                  )}
                  {flagged.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-200">
                      {flagged.map((s) => `${s.name}: ${[s.lowAccuracy && `accuracy ${s.accuracy}%`, s.highPenalty && `${s.penalty} lost to negative marking`].filter(Boolean).join(', ')}`).join(' · ')}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => onLogMistakes(m.id)} icon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />}>Log mistakes</Button>
                    {linked > 0 && <Button size="sm" variant="ghost" onClick={() => onSeeMistakes(m.id)}>{linked} logged</Button>}
                    <span className="flex-1" />
                    <button type="button" aria-label={`Edit ${m.name}`} onClick={() => { setEditing(m); setFormOpen(true) }} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    <button type="button" aria-label={`Delete ${m.name}`} onClick={() => setDeleting(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <ExamTemplateModal isOpen={formatOpen} project={project} onClose={() => setFormatOpen(false)} onSave={(t) => run(() => onSetTemplate(project.id, t), t ? 'Test format saved.' : 'Test format removed.')} />
      <MockForm isOpen={formOpen} projectId={project.id} template={template} editing={editing} draftKey={`test:${userId}:${project.id}`} onClose={() => setFormOpen(false)} onSave={(input) => onSaveTest(editing?.id ?? null, input)} />
      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this test?"
        message={`${deleting?.name ?? ''} will be removed. Mistakes linked to it stay in your journal.`}
        confirmLabel="Delete test"
        onConfirm={async () => { if (deleting) await run(() => onDeleteTest(deleting.id), 'Test deleted.').catch(() => undefined); setDeleting(null) }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
