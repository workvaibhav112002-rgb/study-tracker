import React, { useMemo, useState } from 'react'
import { Eye, RotateCcw, Repeat } from 'lucide-react'
import type { JournalConfig, Mistake, PatternAlert } from '../../types'
import { Button } from '../ui/Button'
import { categoryOf } from '../../lib/journal'
import { describeAlert, matrix } from '../../lib/patterns'
import { Panel } from './ChartBits'

interface Props {
  config: JournalConfig
  mistakes: Mistake[]
  alerts: PatternAlert[]
  onSeeIds: (ids: number[], label: string) => void
  onSeeCell: (filters: Record<string, string>) => void
  onReviewAlert: (a: PatternAlert) => void
}

/** Repeating combinations and a cross-tab of any two categories. */
const PatternsView: React.FC<Props> = ({ config, mistakes, alerts, onSeeIds, onSeeCell, onReviewAlert }) => {
  const cats = config.categories
  const defaultRow = cats.find((c) => c.allow_new) ?? cats[0]
  const defaultCol = categoryOf(config, 'mistake_type') ?? cats.find((c) => c.key !== defaultRow?.key) ?? cats[0]
  const [rowKey, setRowKey] = useState(defaultRow?.key ?? '')
  const [colKey, setColKey] = useState(defaultCol?.key ?? '')
  const mx = useMemo(() => matrix(mistakes, categoryOf(config, rowKey), categoryOf(config, colKey)), [mistakes, config, rowKey, colKey])
  const rule = config.patterns

  return (
    <div className="space-y-5">
      <Panel title="Repeating mistakes" subtitle={`A pattern is the same combination ${rule.threshold} or more times in ${rule.window_days} days. You can change this rule in Customize.`} testId="pattern-alerts">
        {alerts.length === 0 ? (
          <p className="text-sm text-ink-400">No repeats right now. Keep logging and they will show up here before they cost you.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => {
              const label = describeAlert(config, a)
              return (
                <li key={`${a.categories.join(',')}|${a.values.join('|')}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-3 py-2.5">
                  <p className="flex items-center gap-2 text-sm text-ink-50">
                    <Repeat className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                    <span className="font-medium">{label}</span>
                    <span className="font-mono text-xs tabular-nums text-ink-400">{a.count}×</span>
                  </p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onSeeIds(a.mistake_ids, label)} icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}>See</Button>
                    <Button size="sm" variant="secondary" onClick={() => onReviewAlert(a)} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}>Review these</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Where mistakes meet"
        subtitle="Each cell counts mistakes with both values. Darker means more. Click a cell to see them."
        testId="pattern-matrix"
        actions={
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
            <select aria-label="Rows" className="input h-8 w-auto py-0 text-xs" value={rowKey} onChange={(e) => setRowKey(e.target.value)}>
              {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <span aria-hidden="true">×</span>
            <select aria-label="Columns" className="input h-8 w-auto py-0 text-xs" value={colKey} onChange={(e) => setColKey(e.target.value)}>
              {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        }
      >
        {rowKey === colKey ? (
          <p className="text-sm text-ink-400">Pick two different categories.</p>
        ) : mx.rows.length === 0 ? (
          <p className="text-sm text-ink-400">No mistakes have both a {categoryOf(config, rowKey)?.label.toLowerCase()} and a {categoryOf(config, colKey)?.label.toLowerCase()} yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0.5 text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="sr-only">{categoryOf(config, rowKey)?.label}</th>
                    {mx.cols.map((c) => (
                      <th key={c.value} scope="col" className="px-1 pb-1 text-left font-medium text-ink-300">
                        <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: c.color }} aria-hidden="true" />
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mx.rows.map((r) => (
                    <tr key={r.value}>
                      <th scope="row" className="whitespace-nowrap pr-2 text-left font-medium text-ink-200">{r.label}</th>
                      {mx.cols.map((c) => {
                        const n = mx.cells[r.value]?.[c.value] ?? 0
                        // Sequential: one hue, opacity grows with the count.
                        const alpha = n === 0 ? 0 : 0.15 + 0.75 * (n / mx.max)
                        return (
                          <td key={c.value} className="p-0">
                            <button
                              type="button"
                              disabled={n === 0}
                              onClick={() => onSeeCell({ [rowKey]: r.value, [colKey]: c.value })}
                              aria-label={`${r.label} and ${c.label}: ${n}`}
                              className="focus-ring h-9 w-full min-w-[3rem] rounded-md border border-fg/[0.06] font-mono tabular-nums text-ink-50 disabled:cursor-default disabled:text-ink-600"
                              style={{ backgroundColor: n ? `rgb(57 135 229 / ${alpha.toFixed(2)})` : undefined }}
                            >
                              {n || '·'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}

export default PatternsView
