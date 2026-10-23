import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  BarChart3,
  Flame,
  Clock,
  Sparkles,
  Download,
  Calendar,
  Award,
} from 'lucide-react'
import { DashboardStats, Project } from '../types'
import { api } from '../api/client'

interface AnalyticsDashboardProps {
  stats: DashboardStats | null
  projects: Project[]
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  stats,
  projects,
}) => {
  const [exporting, setExporting] = React.useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.exportBackup()
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message)
      } else {
        alert('Export failed. Please ensure you are signed in.')
      }
    } finally {
      setExporting(false)
    }
  }
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading analytics...
      </div>
    )
  }

  // Format hours and minutes
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  // Prep project distribution data for Pie Chart
  const pieData = stats.project_stats.map((ps) => ({
    name: ps.name,
    value: Math.round(ps.total_seconds / 60), // in minutes
    color: ps.color || '#3b82f6',
  }))

  // Prep daily trend data for Bar Chart
  const barData = stats.daily_trend.map((dt) => {
    // Format YYYY-MM-DD to "Mon DD" e.g. "Oct 23"
    const parts = dt.date.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const label = `${monthNames[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`
    return {
      date: label,
      rawDate: dt.date,
      hours: Number((dt.minutes / 60).toFixed(1)),
      minutes: dt.minutes,
    }
  })

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-400" />
            Study Analytics & Insights
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Visual breakdown of your productivity, consistency streak, and study balance.
          </p>
        </div>

        {/* Data Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-brand-400" />
          <span>{exporting ? 'Exporting...' : 'Export JSON Backup'}</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Today's Study</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatTime(stats.today_minutes)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Reset daily at midnight
          </span>
        </div>

        {/* Current Streak */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Daily Streak</span>
            <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
          </div>
          <div className="text-2xl font-extrabold text-orange-400">
            {stats.current_streak_days} <span className="text-sm font-normal text-slate-400">days</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Consecutive study consistency
          </span>
        </div>

        {/* Weekly Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Past 7 Days</span>
            <Calendar className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatTime(stats.weekly_minutes)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Last 7 rolling days
          </span>
        </div>

        {/* Pomodoros Completed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Completed Pomodoros</span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {stats.completed_pomodoros}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Total focus cycles logged
          </span>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Study Hours (14-day Bar Chart) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Daily Study Activity</h3>
            <p className="text-xs text-slate-400 mb-4">Hours logged each day over the past 2 weeks</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                          <p className="font-bold text-slate-200">{data.rawDate}</p>
                          <p className="text-emerald-400 font-semibold mt-1">
                            {formatTime(data.minutes)} ({data.hours} hrs)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Distribution Donut Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Time Distribution by Project</h3>
            <p className="text-xs text-slate-400 mb-4">Cumulative breakdown across your subjects</p>
          </div>

          {pieData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Award className="w-8 h-8 text-slate-600 mb-2" />
              <span>No project study data yet</span>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: data.color }}
                              />
                              <p className="font-bold text-slate-200">{data.name}</p>
                            </div>
                            <p className="text-slate-300 mt-1 font-semibold">
                              {formatTime(data.value)} ({((data.value / Math.max(1, stats.total_minutes)) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-[11px] text-slate-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
