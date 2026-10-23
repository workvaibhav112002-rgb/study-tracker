import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { BarChart3, Flame, Clock, Sparkles, Download, Calendar, Award, Loader2, RefreshCw } from 'lucide-react'
import type { DashboardStats } from '../types'
import { api, errorMessage } from '../api/client'
import { useToast } from './ui/Toast'
import { Button } from './ui/Button'
import { formatMinutes } from '../lib/time'

interface AnalyticsDashboardProps {
  stats: DashboardStats | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface BarDatum {
  date: string
  rawDate: string
  hours: number
  minutes: number
}
interface PieDatum {
  name: string
  value: number
  color: string
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ stats, loading, error, onRetry }) => {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.exportBackup()
      toast.success('Backup downloaded.')
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed.'))
    } finally {
      setExporting(false)
    }
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm gap-3">
        {error ? (
          <>
            <p className="text-rose-400">{error}</p>
            <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Loading analytics…
          </>
        )}
      </div>
    )
  }

  const pieData: PieDatum[] = stats.project_stats.map((ps) => ({
    name: ps.name,
    value: Math.round(ps.total_seconds / 60),
    color: ps.color || '#3b82f6',
  }))

  const barData: BarDatum[] = stats.daily_trend.map((dt) => {
    const [, m, d] = dt.date.split('-')
    return {
      date: `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`,
      rawDate: dt.date,
      hours: Number((dt.minutes / 60).toFixed(1)),
      minutes: dt.minutes,
    }
  })

  const cards = [
    { label: "Today's Study", value: formatMinutes(stats.today_minutes), hint: 'Resets at your local midnight', icon: <Clock className="w-4 h-4 text-emerald-400" aria-hidden="true" /> },
    { label: 'Daily Streak', value: <>{stats.current_streak_days} <span className="text-sm font-normal text-slate-400">days</span></>, hint: 'Consecutive study days', icon: <Flame className="w-4 h-4 text-orange-400 fill-orange-400" aria-hidden="true" />, accent: 'text-orange-400' },
    { label: 'Past 7 Days', value: formatMinutes(stats.weekly_minutes), hint: 'Rolling week', icon: <Calendar className="w-4 h-4 text-sky-400" aria-hidden="true" /> },
    { label: 'Completed Pomodoros', value: stats.completed_pomodoros, hint: 'Total focus cycles logged', icon: <Sparkles className="w-4 h-4 text-yellow-400" aria-hidden="true" /> },
  ]

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 transition-opacity ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-400" aria-hidden="true" />
            Study Analytics & Insights
          </h2>
          <p className="text-sm text-slate-400 mt-1">Visual breakdown of your productivity, consistency streak, and study balance.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting} icon={<Download className="w-4 h-4 text-brand-400" aria-hidden="true" />}>
          {exporting ? 'Exporting…' : 'Export JSON Backup'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">{c.label}</span>
              {c.icon}
            </div>
            <div className={`text-2xl font-extrabold ${c.accent ?? 'text-white'}`}>{c.value}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">{c.hint}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between" aria-label="Daily study activity">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Daily Study Activity</h3>
            <p className="text-xs text-slate-400 mb-4">Hours logged each day over the past 2 weeks</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} angle={-30} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as BarDatum
                    return (
                      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                        <p className="font-bold text-slate-200">{d.rawDate}</p>
                        <p className="text-emerald-400 font-semibold mt-1">
                          {formatMinutes(d.minutes)} ({d.hours} hrs)
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between" aria-label="Time distribution by project">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Time Distribution by Project</h3>
            <p className="text-xs text-slate-400 mb-4">Cumulative breakdown across your subjects</p>
          </div>
          {pieData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Award className="w-8 h-8 text-slate-600 mb-2" aria-hidden="true" />
              <span>No project study data yet</span>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as PieDatum
                      const pct = ((d.value / Math.max(1, stats.total_minutes)) * 100).toFixed(0)
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
                            <p className="font-bold text-slate-200">{d.name}</p>
                          </div>
                          <p className="text-slate-300 mt-1 font-semibold">
                            {formatMinutes(d.value)} ({pct}%)
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span className="text-[11px] text-slate-300">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
