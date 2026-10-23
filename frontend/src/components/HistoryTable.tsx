import React, { useState } from 'react'
import { History, Star, Trash2, Plus, BookOpen } from 'lucide-react'
import type { Project, Session } from '../types'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { formatDateTime, formatDurationSeconds } from '../lib/time'

interface HistoryTableProps {
  sessions: Session[]
  projects: Project[]
  onDeleteSession: (id: number) => Promise<void>
  onOpenManualModal: () => void
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ sessions, projects, onDeleteSession, onOpenManualModal }) => {
  const [filterProjectId, setFilterProjectId] = useState<number | 'all'>('all')
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)

  const filtered = filterProjectId === 'all' ? sessions : sessions.filter((s) => s.project_id === filterProjectId)

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-brand-400" aria-hidden="true" />
            Study Log & History
          </h2>
          <p className="text-sm text-slate-400 mt-1">Detailed record of every focus session, duration, and notes.</p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <label htmlFor="history-filter" className="sr-only">
              Filter by project
            </label>
            <select
              id="history-filter"
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer w-full"
            >
              <option value="all">All Projects ({sessions.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" size="sm" onClick={onOpenManualModal} icon={<Plus className="w-4 h-4 text-brand-400" aria-hidden="true" />} className="whitespace-nowrap">
            Add Manual Entry
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-300">No study sessions logged yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Complete a Pomodoro or use "Add Manual Entry" above to start building your study log.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-4">Project</th>
                  <th scope="col" className="py-3 px-4">Date & Time</th>
                  <th scope="col" className="py-3 px-4">Duration</th>
                  <th scope="col" className="py-3 px-4">Focus</th>
                  <th scope="col" className="py-3 px-4">Notes</th>
                  <th scope="col" className="py-3 px-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: session.project_color || '#3b82f6' }} aria-hidden="true" />
                        <span className="font-semibold text-white">{session.project_name || 'Project'}</span>
                        {session.session_type === 'manual' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">manual</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <time dateTime={session.start_time}>{formatDateTime(session.start_time)}</time>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {formatDurationSeconds(session.duration_seconds)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-0.5" aria-label={`${session.focus_rating} out of 5`} role="img">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 ${session.focus_rating >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={session.notes || undefined}>
                      {session.notes || <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(session)}
                        aria-label={`Delete session from ${formatDateTime(session.start_time)}`}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        title="Delete this study log entry?"
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
