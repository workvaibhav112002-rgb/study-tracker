import React, { useState } from 'react'
import { Star, Trash2, Plus, BookOpen, ChevronDown, Zap } from 'lucide-react'
import type { Project, Session } from '../types'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Skeleton } from './ui/Skeleton'
import { formatDateTime, formatDurationSeconds, formatMinutes } from '../lib/time'

interface HistoryTableProps {
  sessions: Session[]
  projects: Project[]
  loading?: boolean
  onDeleteSession: (id: number) => Promise<void>
  onOpenManualModal: () => void
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ sessions, projects, loading = false, onDeleteSession, onOpenManualModal }) => {
  const [filterProjectId, setFilterProjectId] = useState<number | 'all'>('all')
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)

  const filtered = filterProjectId === 'all' ? sessions : sessions.filter((s) => s.project_id === filterProjectId)
  const filteredMinutes = filtered.reduce((sum, s) => sum + s.duration_seconds / 60, 0)

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Log</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">History</h2>
          <p className="mt-1.5 text-sm text-ink-400">
            {filtered.length} {filtered.length === 1 ? 'session' : 'sessions'} · {formatMinutes(filteredMinutes)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <label htmlFor="history-filter" className="sr-only">
              Filter by project
            </label>
            <select
              id="history-filter"
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="focus-ring glass h-10 w-full cursor-pointer appearance-none rounded-xl pl-3.5 pr-9 text-[13px] font-medium text-ink-200 sm:w-52"
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          </div>
          <Button variant="secondary" size="lg" onClick={onOpenManualModal} icon={<Plus className="h-4 w-4 text-brand-400" aria-hidden="true" />} className="shrink-0">
            <span className="hidden sm:inline">Log session</span>
            <span className="sm:hidden">Log</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading history">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-fg/[0.06] bg-fg/[0.04] text-ink-400">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-ink-50">Nothing logged yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-ink-400">Finish a focus session or log one manually and it will show up here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-ink-300">
              <thead>
                <tr className="border-b border-fg/[0.06] text-ink-500">
                  <th scope="col" className="eyebrow px-5 py-3.5 font-semibold">Project</th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-semibold">When</th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-semibold">Duration</th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-semibold">Focus</th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-semibold">Notes</th>
                  <th scope="col" className="px-5 py-3.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/[0.05]">
                {filtered.map((session) => (
                  <tr key={session.id} className="group transition-colors hover:bg-fg/[0.03]">
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: session.project_color || '#3987e5', boxShadow: `0 0 8px ${session.project_color || '#3987e5'}` }} aria-hidden="true" />
                        <span className="font-medium text-ink-50">{session.project_name || 'Project'}</span>
                        {session.session_type === 'manual' && (
                          <span className="rounded-md border border-fg/[0.06] bg-fg/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-500">manual</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-ink-400">
                      <time dateTime={session.start_time}>{formatDateTime(session.start_time)}</time>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="chip border-brand-500/20 bg-brand-500/10 font-mono tabular-nums text-brand-300">{formatDurationSeconds(session.duration_seconds)}</span>
                      {(session.interruptions ?? 0) > 0 && (
                        <span className="chip ml-1.5 border-accent-amber/20 bg-accent-amber/10 text-amber-200" aria-label={`${session.interruptions} interruptions`} title="Pauses and tab switches">
                          <Zap className="h-3 w-3" aria-hidden="true" />
                          {session.interruptions}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-0.5" aria-label={`${session.focus_rating} out of 5`} role="img">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} aria-hidden="true" className={`h-3.5 w-3.5 ${session.focus_rating >= star ? 'fill-accent-amber text-accent-amber' : 'text-ink-700'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-5 py-3.5 text-ink-400" title={session.notes || undefined}>
                      {session.notes || <span className="text-ink-700">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(session)}
                        aria-label={`Delete session from ${formatDateTime(session.start_time)}`}
                        className="focus-ring rounded-lg p-1.5 text-ink-600 opacity-60 transition-all hover:bg-fg/[0.06] hover:text-rose-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete this entry?"
        message={
          pendingDelete
            ? `${formatDurationSeconds(pendingDelete.duration_seconds)} on ${pendingDelete.project_name ?? 'this project'} will be removed from your history and stats.`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await onDeleteSession(pendingDelete.id)
            setPendingDelete(null)
          } catch {
            /* surfaced by caller */
          }
        }}
      />
    </div>
  )
}
