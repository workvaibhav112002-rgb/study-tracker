import React, { useMemo, useState } from 'react'
import { Search, Pencil, Trash2, Download, Clock, Layers } from 'lucide-react'
import type { JournalConfig, Mistake, MistakeStatus, Mock } from '../../types'
import { inputClass } from '../ui/Field'
import { Button } from '../ui/Button'
import { renderMarkdown } from '../../lib/markdown'
import { STATUS_LABELS, fieldLabel, optionColor, optionLabel, tagValues, valuesInUse } from '../../lib/journal'
import { EMPTY_JOURNAL_FILTER, applyJournalFilter, type JournalFilter } from '../../lib/journalFilter'

interface Props {
  config: JournalConfig
  mistakes: Mistake[]
  tests: Mock[]
  filter: JournalFilter
  onFilter: (f: JournalFilter) => void
  onEdit: (m: Mistake) => void
  onDelete: (m: Mistake) => void
  onMakeCard: (m: Mistake) => void
  onExportCsv: (visible: Mistake[]) => void
}

export const JournalList: React.FC<Props> = ({ config, mistakes, tests, filter, onFilter, onEdit, onDelete, onMakeCard, onExportCsv }) => {
  const [expanded, setExpanded] = useState<number | null>(null)
  const visible = useMemo(() => applyJournalFilter(mistakes, filter), [mistakes, filter])
  const active = Boolean(filter.q || filter.status || filter.testId !== '' || filter.ids || Object.values(filter.tags).some(Boolean))
  const testName = (id: number | null) => tests.find((m) => m.id === id)?.name
  const custom = config.fields.filter((f) => f.type !== 'builtin')

  return (
    <section aria-label="Mistake journal">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <label className="relative col-span-2 sm:col-span-3 lg:col-span-1">
          <span className="sr-only">Search mistakes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input className={`${inputClass} pl-8`} placeholder="Search" value={filter.q} onChange={(e) => onFilter({ ...filter, q: e.target.value })} />
        </label>
        {config.categories.map((c) => {
          const vals = valuesInUse(mistakes, c.key)
          return (
            <select key={c.key} aria-label={`Filter by ${c.label}`} className={inputClass} value={filter.tags[c.key] ?? ''} onChange={(e) => onFilter({ ...filter, tags: { ...filter.tags, [c.key]: e.target.value } })}>
              <option value="">All {c.label.toLowerCase()}</option>
              {vals.map((v) => <option key={v.value} value={v.value}>{optionLabel(c, v.value)} ({v.count})</option>)}
            </select>
          )
        })}
        {config.tests_enabled && tests.length > 0 && (
          <select aria-label="Filter by test" className={inputClass} value={filter.testId} onChange={(e) => onFilter({ ...filter, testId: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">All tests</option>
            {tests.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <select aria-label="Filter by review status" className={inputClass} value={filter.status} onChange={(e) => onFilter({ ...filter, status: e.target.value as MistakeStatus | '' })}>
          <option value="">Any status</option>
          {(Object.keys(STATUS_LABELS) as MistakeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span role="status">
          {visible.length} of {mistakes.length} mistakes{filter.idsLabel && <> · {filter.idsLabel}</>}
          {active && <> · <button type="button" className="focus-ring rounded text-brand-300 hover:underline" onClick={() => onFilter(EMPTY_JOURNAL_FILTER)}>Clear filters</button></>}
        </span>
        <Button size="sm" variant="ghost" disabled={visible.length === 0} onClick={() => onExportCsv(visible)} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>Export CSV</Button>
      </div>

      {visible.length === 0 ? (
        <p className="card p-8 text-center text-sm text-ink-400">{mistakes.length === 0 ? 'No mistakes yet. Each time something goes wrong, log it here and the patterns will show up.' : 'Nothing matches these filters.'}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => {
            const open = expanded === m.id
            const over = m.actual_seconds !== null && m.ideal_seconds !== null ? m.actual_seconds - m.ideal_seconds : null
            const extras = custom.filter((f) => m.extra[f.key] !== undefined && m.extra[f.key] !== '')
            return (
              <li key={m.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : m.id)} className="focus-ring min-w-0 flex-1 rounded-lg text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {config.categories.flatMap((c) =>
                        tagValues(m, c.key).map((v) => (
                          <span key={`${c.key}:${v}`} className="chip border-fg/[0.08] bg-fg/[0.04] text-ink-100" title={c.label}>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: optionColor(c, v) }} aria-hidden="true" />
                            <span className="sr-only">{c.label}: </span>
                            {optionLabel(c, v)}
                          </span>
                        )),
                      )}
                      {m.status !== 'active' && <span className="chip border-fg/[0.06] bg-fg/[0.03] text-ink-400">{STATUS_LABELS[m.status]}</span>}
                      {over !== null && over > 0 && <span className="chip border-amber-400/20 bg-amber-400/[0.06] text-amber-200"><Clock className="h-3 w-3" aria-hidden="true" />+{over}s</span>}
                    </div>
                    {m.question && <p className={`mt-1.5 text-xs text-ink-400 ${open ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}>{m.question}</p>}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-[11px] text-ink-500">{testName(m.mock_id) ?? m.created_at.slice(0, 10)}</span>
                    <button type="button" aria-label="Make a flashcard from this mistake" title="Make flashcard" onClick={() => onMakeCard(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50"><Layers className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    <button type="button" aria-label="Edit mistake" onClick={() => onEdit(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    <button type="button" aria-label="Delete mistake" onClick={() => onDelete(m)} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
                {m.rule && (
                  <div className="mt-2 rounded-xl border border-brand-500/15 bg-brand-500/[0.05] px-3 py-2 text-xs text-ink-100">
                    <span className="sr-only">{fieldLabel(config, 'rule', 'Lesson')}: </span>
                    <div className="prose-card" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.rule) }} />
                  </div>
                )}
                {open && m.solution && <div className="prose-card mt-2 text-xs text-ink-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.solution) }} />}
                {open && extras.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
                    {extras.map((f) => (
                      <div key={f.key}><dt className="inline">{f.label}: </dt><dd className="inline text-ink-200">{m.extra[f.key] === true ? 'Yes' : m.extra[f.key] === false ? 'No' : String(m.extra[f.key])}</dd></div>
                    ))}
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
