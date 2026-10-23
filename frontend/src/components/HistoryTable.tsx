import React, { useState } from 'react'
import { History, Star, Trash2, Plus, Filter, Calendar, Clock, BookOpen } from 'lucide-react'
import { Project, Session } from '../types'

interface HistoryTableProps {
  sessions: Session[]
  projects: Project[]
  onDeleteSession: (id: number) => Promise<void>
  onOpenManualModal: () => void
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  sessions,
  projects,
  onDeleteSession,
  onOpenManualModal,
}) => {
  const [filterProjectId, setFilterProjectId] = useState<number | 'all'>('all')

  const filteredSessions = sessions.filter((s) => {
    if (filterProjectId === 'all') return true
    return s.project_id === filterProjectId
  })

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}h ${remMins}m`
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-brand-400" />
            Study Log & History
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Detailed record of every focus session, duration, and notes.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Project Filter */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={filterProjectId}
              onChange={(e) =>
                setFilterProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
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

          {/* Add Manual Log Button */}
          <button
            onClick={onOpenManualModal}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-brand-400" />
            <span>Add Manual Entry</span>
          </button>
        </div>
      </div>

      {/* Sessions Table / Cards */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No study sessions logged yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Complete a Pomodoro timer session or click "Add Manual Entry" above to start building your study log!
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Focus</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Project */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: session.project_color || '#3b82f6' }}
                        />
                        <span className="font-semibold text-white">
                          {session.project_name || 'Project'}
                        </span>
                        {session.session_type === 'manual' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                            manual
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {formatDate(session.start_time)}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {formatDuration(session.duration_seconds)}
                      </span>
                    </td>

                    {/* Focus Rating */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              session.focus_rating >= star
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                      {session.notes || <span className="text-slate-600 italic">—</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (confirm('Delete this study log entry?')) {
                            onDeleteSession(session.id)
                          }
                        }}
                        title="Delete entry"
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
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
    </div>
  )
}
