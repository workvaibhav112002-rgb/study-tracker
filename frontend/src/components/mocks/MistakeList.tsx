import React, { useMemo, useState } from 'react'
import { Search, Pencil, Trash2, Download, Clock } from 'lucide-react'
import type { Mistake, MistakeStatus, Mock, RootCause } from '../../types'
import { inputClass } from '../ui/Field'
import { Button } from '../ui/Button'
import { renderMarkdown } from '../../lib/markdown'
import { ROOT_CAUSES, STATUS_LABELS, rootCauseLabel } from '../../lib/examTemplates'
import { EMPTY_FILTER, applyMistakeFilter, type MistakeFilterState } from '../../lib/mistakeFilter'

interface Props {
  mistakes: Mistake[]
  mocks: Mock[]
  filter: MistakeFilterState
  onFilter: (f: MistakeFilterState) => void
  onEdit: (m: Mistake) => void
  onDelete: (m: Mistake) => void
  onExportCsv: (visible: Mistake[]) => void
}

const CAUSE_CHIP: Record<RootCause, string> = {
  concept: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  procedural: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  time_ego: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
}

export const MistakeList: React.FC<Props> = ({ mistakes, mocks, filter, onFilter, onEdit, onDelete, onExportCsv }) => {
  const [expanded, setExpanded] = useState<number | null>(null)
  const subjects = useMemo(() => [...new Set(mistakes.map((m) => m.subject))].sort(), [mistakes])
  const patterns = useMemo(() => [...new Set(mistakes.filter((m) => !filter.subject || m.subject === filter.subject).map((m) => m.pattern))].sort(), [mistakes, filter.subject])
  const visible = useMemo(() => applyMistakeFilter(mistakes, filter), [mistakes, filter])
  const mockName = (id: number | null) => mocks.find((m) => m.id === id)?.name
  const active = Object.entries(filter).some(([, v]) => v !== '')

  return (
    <section aria-label="Mistake log">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <label className="relative col-span-2 sm:col-span-3 lg:col-span-2">
          <span className="sr-only">Search mistakes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input className={`${inputClass} pl-8`} placeholder="Search questions, rules, notes" value={filter.q} onChange={(e) => onFilter({ ...filter, q: e.target.value })} />
        </label>
        <select aria-label="Filter by subject" className={inputClass} value={filter.subject} onChange={(e) => onFilter({ ...filter, subject: e.target.value, pattern: '' })}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Filter by pattern" className={inputClass} value={filter.pattern} onChange={(e) => onFilter({ ...filter, pattern: e.target.value })}>
          <option value="">All patterns</option>
          {patterns.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Filter by root cause" className={inputClass} value={filter.rootCause} onChange={(e) => onFilter({ ...filter, rootCause: e.target.value as RootCause | '' })}>
          <option value="">All root causes</option>
          {ROOT_CAUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select aria-label="Filter by mock" className={inputClass} value={filter.mockId} onChange={(e) => onFilter({ ...filter, mockId: e.target.value ? Number(e.target.value) : '' })}>
          <option value="">All mocks</option>
          {mocks.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Filter by revision status" className={inputClass} value={filter.status} onChange={(e) => onFilter({ ...filter, status: e.target.value as MistakeStatus | '' })}>
          <option value="">Any status</option>
          {(Object.keys(STATUS_LABELS) as MistakeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span role="status">{visible.length} of {mistakes.length} mistakes{active && <> · <button type="button" className="focus-ring rounded text-brand-300 hover:underline" onClick={() => onFilter(EMPTY_FILTER)}>Clear filters</button></>}</span>
        <Button size="sm" variant="ghost" disabled={visible.length === 0} onClick={() => onExportCsv(visible)} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>Export CSV</Button>
      </div>

      {visible.length === 0 ? (
        <p className="card p-8 text-center text-sm text-ink-400">{mistakes.length === 0 ? 'No mistakes logged yet. After your next mock, log each wrong or slow question here.' : 'Nothing matches these filters.'}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => {
            const open = expanded === m.id
            const over = m.actual_seconds !== null && m.ideal_seconds !== null ? m.actual_seconds - m.ideal_seconds : null
            return (
              <li key={m.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : m.id)} className="focus-ring min-w-0 flex-1 rounded-lg text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="chip border-fg/[0.08] bg-fg/[0.04] text-ink-200">{m.subject}</span>
                      <span className="text-sm font-medium text-ink-50">{m.pattern}</span>
                      <span className={`chip ${CAUSE_CHIP[m.root_cause]}`}>{rootCauseLabel(m.root_cause)}</span>
                      {m.status !== 'active' && <span className="chip border-fg/[0.06] bg-fg/[0.03] text-ink-400">{STATUS_LABELS[m.status]}</span>}
                      {over !== null && over > 0 && <span className="chip border-amber-400/20 bg-amber-400/[0.06] text-amber-200"><Clock className="h-3 w-3" aria-hidden="true" />+{over}s</span>}
                    </div>
                    {m.question && <p className={`mt-1.5 text-xs text-ink-400 ${open ? '' : 'line-clamp-1'}`}>{m.question}</p>}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-[11px] text-ink-500">{mockName(m.mock_id) ?? m.created_at.slice(0, 10)}</span>
                    <button type="button" aria-label={`Edit mistake: ${m.pattern}`} onClick={() => onEdit(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    <button type="button" aria-label={`Delete mistake: ${m.pattern}`} onClick={() => onDelete(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
                {(open || m.rule) && m.rule && (
                  <div className="prose-card mt-2 rounded-xl border border-brand-500/15 bg-brand-500/[0.05] px-3 py-2 text-xs text-ink-100" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.rule) }} />
                )}
                {open && m.solution && <div className="prose-card mt-2 text-xs text-ink-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.solution) }} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
