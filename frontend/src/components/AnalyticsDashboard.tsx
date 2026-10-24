import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { Flame, Clock, Sparkles, Download, Calendar, Award, RefreshCw, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DailyStat, DashboardStats, HourStat, WeeklyReview } from '../types'
import { WeeklyReviewCard } from './WeeklyReviewCard'
import { HeatmapYear } from './HeatmapYear'
import { BestHours } from './BestHours'
import { api, errorMessage } from '../api/client'
import { useToast } from './ui/Toast'
import { Button } from './ui/Button'
import { formatMinutes } from '../lib/time'

interface AnalyticsDashboardProps {
  stats: DashboardStats | null
  heatmap: DailyStat[]
  hours: HourStat[]
  review: WeeklyReview | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SURFACE = '#0b0d13'
const GRID = 'rgba(255,255,255,0.06)'
const AXIS = '#6b7388'

interface BarDatum {
  date: string
  rawDate: string
  hours: number
  minutes: number
  isToday: boolean
}
interface PieDatum {
  name: string
  value: number
  color: string
}

import { ChartTooltip as TooltipCard } from './ui/ChartTooltip'

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ stats, heatmap, hours, review, loading, error, onRetry }) => {
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
      <div className="card mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-12 text-center">
        <p className="text-sm text-rose-300">{error ?? 'Analytics are unavailable right now.'}</p>
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
          Try again
        </Button>
      </div>
    )
  }

  const pieData: PieDatum[] = stats.project_stats.map((ps) => ({ name: ps.name, value: Math.round(ps.total_seconds / 60), color: ps.color || '#3987e5' }))
  const last = stats.daily_trend[stats.daily_trend.length - 1]?.date
  const barData: BarDatum[] = stats.daily_trend.map((dt) => {
    const [, m, d] = dt.date.split('-')
    return {
      date: `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`,
      rawDate: dt.date,
      hours: Number((dt.minutes / 60).toFixed(2)),
      minutes: dt.minutes,
      isToday: dt.date === last,
    }
  })
  const peak = Math.max(0, ...barData.map((b) => b.minutes))

  const wow = stats.week_over_week
  const wowText = !wow ? 'Rolling week' : wow.delta_percent === null ? 'No data last week' : `${wow.delta_minutes >= 0 ? '+' : '−'}${formatMinutes(Math.abs(wow.delta_minutes))} vs last week`
  const WowIcon = !wow || wow.delta_minutes === 0 ? Minus : wow.delta_minutes > 0 ? TrendingUp : TrendingDown
  const cards = [
    { label: 'Today', value: formatMinutes(stats.today_minutes), hint: 'Resets at your local midnight', icon: <Clock className="h-4 w-4" aria-hidden="true" />, tone: 'text-brand-400 bg-brand-500/10 border-brand-500/20' },
    { label: 'Streak', value: `${stats.current_streak_days}d`, hint: 'Consecutive study days', icon: <Flame className="h-4 w-4 fill-current" aria-hidden="true" />, tone: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    { label: 'Last 7 days', value: formatMinutes(stats.weekly_minutes), hint: wowText, icon: <WowIcon className="h-4 w-4" aria-hidden="true" />, tone: 'text-accent-sky bg-accent-sky/10 border-accent-sky/20' },
    { label: 'Pomodoros', value: String(stats.completed_pomodoros), hint: 'Completed focus cycles', icon: <Sparkles className="h-4 w-4" aria-hidden="true" />, tone: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20' },
    { label: 'Interruptions', value: (stats.avg_interruptions ?? 0).toFixed(1), hint: 'Average per session', icon: <Zap className="h-4 w-4" aria-hidden="true" />, tone: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20' },
    { label: 'Week over week', value: wow && wow.delta_percent !== null ? `${wow.delta_percent >= 0 ? '+' : ''}${Math.round(wow.delta_percent)}%` : '—', hint: wow ? `${formatMinutes(wow.previous_week_minutes)} the week before` : 'Needs two weeks of data', icon: <Calendar className="h-4 w-4" aria-hidden="true" />, tone: 'text-accent-violet bg-accent-violet/10 border-accent-violet/20' },
  ]

  return (
    <div className={`mx-auto max-w-5xl py-6 transition-opacity duration-300 sm:py-10 ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Insights</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">Analytics</h2>
          <p className="mt-1.5 text-sm text-ink-400">{formatMinutes(stats.total_minutes)} studied in total, across every project.</p>
        </div>
        <Button variant="secondary" size="lg" onClick={handleExport} loading={exporting} icon={<Download className="h-4 w-4 text-brand-400" aria-hidden="true" />}>
          {exporting ? 'Exporting…' : 'Export backup'}
        </Button>
      </div>

      {review && (
        <div className="mb-6">
          <WeeklyReviewCard review={review} />
        </div>
      )}

      <div className="stagger mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card card-hover p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{c.label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${c.tone}`}>{c.icon}</span>
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight text-ink-50 tabular-nums">{c.value}</div>
            <span className="mt-1 block text-[11px] text-ink-500">{c.hint}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card p-5 sm:p-6 lg:col-span-3" aria-label="Daily study activity">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-ink-50">Daily activity</h3>
              <p className="mt-0.5 text-xs text-ink-500">Minutes per day over the last two weeks</p>
            </div>
            {peak > 0 && (
              <span className="chip border-white/[0.06] bg-white/[0.04] text-ink-300">
                Peak <span className="font-mono tabular-nums text-ink-50">{formatMinutes(peak)}</span>
              </span>
            )}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
                <defs>
                  <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
                <XAxis dataKey="date" stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval={1} />
                <YAxis stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} unit="m" dataKey="minutes" />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as BarDatum
                    return <TooltipCard title={d.rawDate} value={formatMinutes(d.minutes)} />
                  }}
                />
                <Bar dataKey="minutes" fill="url(#barFill)" radius={[4, 4, 0, 0]} maxBarSize={24}>
                  {barData.map((b) => (
                    <Cell key={b.rawDate} fill={b.isToday ? 'url(#barFill)' : 'rgba(110,231,183,0.45)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-2" aria-label="Time distribution by project">
          <h3 className="text-base font-semibold text-ink-50">By project</h3>
          <p className="mt-0.5 text-xs text-ink-500">Share of all study time</p>
          {pieData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-xs text-ink-500">
              <Award className="mb-2 h-7 w-7 text-ink-700" aria-hidden="true" />
              No project data yet
            </div>
          ) : (
            <>
              <div className="relative mx-auto mt-2 h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={2} dataKey="value" stroke={SURFACE} strokeWidth={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as PieDatum
                        const pct = ((d.value / Math.max(1, stats.total_minutes)) * 100).toFixed(0)
                        return <TooltipCard title={d.name} value={`${formatMinutes(d.value)} · ${pct}%`} swatch={d.color} />
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-semibold tabular-nums text-ink-50">{pieData.length}</span>
                  <span className="eyebrow">{pieData.length === 1 ? 'project' : 'projects'}</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {pieData.slice(0, 5).map((d) => {
                  const pct = (d.value / Math.max(1, stats.total_minutes)) * 100
                  return (
                    <li key={d.name} className="text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-ink-200">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
                          <span className="truncate">{d.name}</span>
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-ink-400">{formatMinutes(d.value)}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-5" aria-label="Last twelve months">
          <h3 className="text-base font-semibold text-ink-50">Last twelve months</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-500">Every day you studied, darker means more minutes</p>
          <HeatmapYear days={heatmap} />
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-5" aria-label="Best hours">
          <h3 className="text-base font-semibold text-ink-50">Best hours</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-500">When your focus sessions start, across all time</p>
          <BestHours hours={hours} />
        </section>
      </div>
    </div>
  )
}
