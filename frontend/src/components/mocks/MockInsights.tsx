import React, { useMemo } from 'react'
import { ComposedChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { TrendingUp, Droplets, Grid3x3 } from 'lucide-react'
import type { ExamTemplate, Mistake, Mock } from '../../types'
import { ChartTooltip } from '../ui/ChartTooltip'
import { clearsTarget, cutoffTrajectory, marksLeakage, patternMatrix, totalWastedMinutes, type Zone } from '../../lib/mockInsights'

interface Props {
  mocks: Mock[]
  mistakes: Mistake[]
  template: ExamTemplate | null | undefined
}

const GRID = 'rgb(var(--fg) / 0.08)'
const AXIS = 'rgb(var(--ink-500))'
const BRAND = 'rgb(var(--brand-400))'
const SKY = '#4cc2f5'
const AMBER = '#f5b63d'
const ROSE = '#f26a86'
const VIOLET = '#8b7cf6'

const ZONE_STYLE: Record<Zone, { cell: string; label: string }> = {
  green: { cell: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100', label: 'First pass' },
  yellow: { cell: 'border-amber-400/25 bg-amber-400/10 text-amber-100', label: 'Second pass' },
  red: { cell: 'border-rose-400/30 bg-rose-400/[0.12] text-rose-100', label: 'Skip until fixed' },
}

const Panel: React.FC<{ title: string; icon: React.ElementType; subtitle?: React.ReactNode; children: React.ReactNode }> = ({ title, icon: Icon, subtitle, children }) => (
  <section className="card p-5" aria-label={title}>
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-fg/[0.08] bg-fg/[0.04] text-brand-400"><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div>
        <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
)

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** Cutoff trajectory, marks leakage and the pattern skip matrix. */
const MockInsights: React.FC<Props> = ({ mocks, mistakes, template }) => {
  const target = template?.target_score ?? 0
  const trajectory = useMemo(() => cutoffTrajectory(mocks, template).map((p) => ({ ...p, label: shortDate(p.date) })), [mocks, template])
  const leakage = useMemo(() => marksLeakage(mocks, mistakes, template).map((p) => ({ ...p, label: shortDate(p.date) })), [mocks, mistakes, template])
  const matrix = useMemo(() => patternMatrix(mistakes), [mistakes])
  const wasted = useMemo(() => totalWastedMinutes(mistakes), [mistakes])
  const clears = clearsTarget(trajectory, target)
  const latest = trajectory[trajectory.length - 1]
  const leakTotal = leakage.reduce((a, p) => ({ silly: a.silly + p.silly, ego: a.ego + p.ego }), { silly: 0, ego: 0 })

  return (
    <div className="space-y-5">
      <Panel
        title="Cutoff trajectory"
        icon={TrendingUp}
        subtitle={
          trajectory.length === 0 ? 'Log a mock to start the trendline.' : target > 0 ? (
            <span>
              4-week average <strong className="tabular-nums text-ink-200">{latest.rolling}</strong> against a target of {target}:{' '}
              <span className={clears ? 'text-brand-300' : 'text-rose-300'}>{clears ? 'clearing the bar' : 'below the bar'}</span>
            </span>
          ) : 'Set a target score in the exam pattern to draw the cutoff line.'
        }
      >
        {trajectory.length > 0 && (
          <div className="h-64" data-testid="cutoff-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trajectory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof trajectory)[number]
                  return <ChartTooltip title={`${d.name} · ${d.date}`} value={`Score ${d.net} · 4-week avg ${d.rolling}`} />
                }} />
                {target > 0 && <ReferenceLine y={target} stroke={ROSE} strokeDasharray="4 4" label={{ value: `Target ${target}`, fill: ROSE, fontSize: 11, position: 'insideTopRight' }} />}
                <Line type="monotone" dataKey="net" name="Score" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="rolling" name="4-week average" stroke={SKY} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(var(--ink-400))' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel
        title="Marks leakage"
        icon={Droplets}
        subtitle={leakage.length === 0 ? 'Link mistakes to a mock to see where marks went.' : <>Across these mocks: <strong className="tabular-nums text-ink-200">{leakTotal.silly.toFixed(2)}</strong> marks to calculation slips and <strong className="tabular-nums text-ink-200">{leakTotal.ego.toFixed(2)}</strong> to ego and time traps. Each logged mistake counts as a wrong answer.</>}
      >
        {leakage.length > 0 && (
          <div className="h-64" data-testid="leakage-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leakage} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%" maxBarSize={56}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--fg) / 0.05)' }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof leakage)[number]
                  return <ChartTooltip title={`${d.name}`} value={`Scored ${d.net} · clean run ${d.clean} · slips ${d.silly} · traps ${d.ego} · concepts ${d.concept}`} />
                }} />
                <Bar dataKey="net" name="Scored" stackId="a" fill={BRAND} isAnimationActive={false} />
                <Bar dataKey="silly" name="Lost: calculation" stackId="a" fill={AMBER} isAnimationActive={false} />
                <Bar dataKey="ego" name="Lost: ego / time" stackId="a" fill={ROSE} isAnimationActive={false} />
                <Bar dataKey="concept" name="Lost: concept gap" stackId="a" fill={VIOLET} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(var(--ink-400))' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel
        title="First pass vs skip"
        icon={Grid3x3}
        subtitle={matrix.length === 0 ? 'Patterns appear here as you log mistakes.' : <>Built from your logged mistakes. {wasted > 0 && <>Slow questions cost you <strong className="tabular-nums text-ink-200">{wasted} min</strong> in total.</>}</>}
      >
        {matrix.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              {(Object.keys(ZONE_STYLE) as Zone[]).map((z) => (
                <span key={z} className={`chip ${ZONE_STYLE[z].cell}`}>{ZONE_STYLE[z].label}</span>
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="pattern-matrix">
              {matrix.map((p) => (
                <li key={p.pattern} className={`rounded-2xl border p-3 ${ZONE_STYLE[p.zone].cell}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{p.pattern}</span>
                    <span className="sr-only">{ZONE_STYLE[p.zone].label}</span>
                    <span className="font-mono text-xs tabular-nums opacity-80">{p.count}×</span>
                  </div>
                  <p className="mt-1 text-[11px] opacity-75">
                    {p.subject}
                    {p.avgActual !== null && <> · avg {p.avgActual}s{p.avgIdeal !== null && <> vs {p.avgIdeal}s ideal</>}</>}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
}

export default MockInsights
