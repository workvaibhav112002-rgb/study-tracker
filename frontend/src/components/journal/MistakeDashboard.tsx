import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Eye, RotateCcw, Layers, Repeat, Target } from 'lucide-react'
import type { JournalConfig, Mistake, PatternAlert } from '../../types'
import { ChartTooltip } from '../ui/ChartTooltip'
import { Button } from '../ui/Button'
import { categoryOf, optionLabel, PALETTE } from '../../lib/journal'
import { breakdown, kpis, lagScores, masterySeries, trends, weeklySeries } from '../../lib/patterns'
import { DataTable, Legend, Panel } from './ChartBits'
import { AXIS, GRID, SURFACE, shortWeek } from '../../lib/chartTheme'

interface Props {
  config: JournalConfig
  mistakes: Mistake[]
  alerts: PatternAlert[]
  reviewDue: number | null
  onSeeMistakes: (filter: { category: string; value: string }) => void
  onReview: (filter: { category: string; value: string } | null) => void
  onMakeCards: (filter: { category: string; value: string }) => void
  onLog: () => void
}

type Range = 28 | 91 | 0

const DAY = 86_400_000

/** Overview of the journal: what to focus on next and how it is trending. */
const MistakeDashboard: React.FC<Props> = ({ config, mistakes, alerts, reviewDue, onSeeMistakes, onReview, onMakeCards, onLog }) => {
  const [range, setRange] = useState<Range>(91)
  const firstOpen = config.categories.find((c) => c.allow_new) ?? config.categories[0]
  const [focusKey, setFocusKey] = useState(firstOpen?.key ?? '')
  const stackCat = categoryOf(config, 'mistake_type') ?? config.categories.find((c) => !c.allow_new && c.options.length > 0)
  const [breakKey, setBreakKey] = useState(config.categories.find((c) => c.key !== stackCat?.key)?.key ?? config.categories[0]?.key ?? '')
  const now = Date.now()
  const inRange = useMemo(() => (range ? mistakes.filter((m) => now - Date.parse(m.created_at) < range * DAY) : mistakes), [mistakes, range, now])
  // Charts start at the first logged mistake (at least 4 weeks), capped by the range.
  const sinceFirst = Math.ceil((now - Math.min(...mistakes.map((m) => Date.parse(m.created_at)), now)) / (7 * DAY)) + 1
  const weeks = Math.max(4, Math.min(range === 28 ? 4 : range === 91 ? 13 : 52, sinceFirst))

  const k = useMemo(() => kpis(mistakes, now), [mistakes, now])
  const focusCat = categoryOf(config, focusKey) ?? firstOpen
  const lag = useMemo(() => (focusCat ? lagScores(inRange, config, focusCat.key, now).slice(0, 5) : []), [inRange, config, focusCat, now])
  const weekly = useMemo(() => (stackCat ? weeklySeries(inRange, stackCat.key, weeks, now) : []), [inRange, stackCat, weeks, now])
  const stackKeys = useMemo(() => {
    if (!stackCat) return []
    const present = new Set(weekly.flatMap((w) => Object.keys(w).filter((x) => x !== 'week' && x !== 'total')))
    const ordered = stackCat.options.filter((o) => present.has(o.key)).map((o) => ({ key: o.key, label: o.label, color: o.color || PALETTE[7] }))
    const others = [...present].filter((x) => !stackCat.options.some((o) => o.key === x))
    return [...ordered, ...others.map((x) => ({ key: x, label: x === '__none' ? 'Not set' : optionLabel(stackCat, x), color: PALETTE[7] }))]
  }, [weekly, stackCat])
  const breakCat = categoryOf(config, breakKey)
  const slices = useMemo(() => breakdown(inRange, breakCat, 8), [inRange, breakCat])
  const mastery = useMemo(() => masterySeries(mistakes, weeks, now), [mistakes, weeks, now])
  const tr = useMemo(() => trends(mistakes, focusCat, now), [mistakes, focusCat, now])

  if (mistakes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Target className="mx-auto mb-3 h-8 w-8 text-brand-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink-50">Every mistake is a breadcrumb</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">Log a slip the moment it happens. Over a few weeks this dashboard shows what keeps going wrong, why, and what to fix first.</p>
        <Button className="mt-5" onClick={onLog}>Log your first mistake</Button>
      </div>
    )
  }

  const delta = k.thisWeek - k.lastWeek
  const tiles = [
    { label: 'This week', value: String(k.thisWeek), note: k.lastWeek || k.thisWeek ? `${delta === 0 ? 'same as' : delta > 0 ? `${delta} more than` : `${-delta} fewer than`} last week` : 'nothing logged yet' },
    { label: 'Repeating patterns', value: String(alerts.length), note: alerts.length ? 'see Patterns' : 'none right now' },
    { label: 'Ready to review', value: reviewDue === null ? '…' : String(reviewDue), note: 'in your review deck' },
    { label: 'Locked in', value: `${k.lockedShare}%`, note: `of ${k.total} mistakes` },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Dashboard filters">
        <label className="sr-only" htmlFor="dash-range">Time range</label>
        <select id="dash-range" className="input h-9 w-auto py-0 text-xs" value={range} onChange={(e) => setRange(Number(e.target.value) as Range)}>
          <option value={28}>Last 4 weeks</option>
          <option value={91}>Last 3 months</option>
          <option value={0}>All time</option>
        </select>
        <label className="sr-only" htmlFor="dash-focus">Focus on</label>
        <select id="dash-focus" className="input h-9 w-auto py-0 text-xs" value={focusCat?.key ?? ''} onChange={(e) => setFocusKey(e.target.value)}>
          {config.categories.map((c) => <option key={c.key} value={c.key}>Focus by {c.label.toLowerCase()}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="journal-kpis">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <p className="eyebrow">{t.label}</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-ink-50">{t.value}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{t.note}</p>
          </div>
        ))}
      </div>

      <Panel title="Focus next" subtitle={`The ${focusCat?.label.toLowerCase() ?? 'items'} that need you most: recent mistakes count double, repeats and unlearned ones add weight.`} testId="focus-next">
        {lag.length === 0 ? (
          <p className="text-sm text-brand-300">Everything in this range is locked in. Nice work.</p>
        ) : (
          <ol className="space-y-2">
            {lag.map((r, i) => {
              const f = { category: focusCat!.key, value: r.value }
              return (
                <li key={r.value} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-fg/[0.06] bg-fg/[0.02] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-50">
                      <span className="font-mono text-xs text-ink-500">{i + 1}</span>
                      {r.label}
                      {r.repeating && <span className="chip border-rose-400/25 bg-rose-400/10 text-rose-200"><Repeat className="h-3 w-3" aria-hidden="true" />repeating</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{r.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onSeeMistakes(f)} icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`See mistakes for ${r.label}`}>See</Button>
                    <Button size="sm" variant="secondary" onClick={() => onReview(f)} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`Review mistakes for ${r.label}`}>Review these</Button>
                    <Button size="sm" variant="ghost" onClick={() => onMakeCards(f)} icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`Make flashcards for ${r.label}`}>Flashcards</Button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {stackCat && (
          <Panel title="Mistakes per week" subtitle={`Split by ${stackCat.label.toLowerCase()}`} testId="weekly-chart">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="week" tickFormatter={shortWeek} stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
                  <YAxis allowDecimals={false} stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgb(var(--fg) / 0.05)' }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload as Record<string, number | string>
                    const parts = stackKeys.filter((s) => row[s.key]).map((s) => `${s.label} ${row[s.key]}`)
                    return <ChartTooltip title={`Week of ${shortWeek(String(row.week))}`} value={`${row.total} total${parts.length ? ` · ${parts.join(' · ')}` : ''}`} />
                  }} />
                  {stackKeys.map((s, i) => (
                    <Bar key={s.key} dataKey={s.key} stackId="w" fill={s.color} stroke={SURFACE} strokeWidth={2} radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} maxBarSize={40} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Legend items={stackKeys.map((s) => ({ label: s.label, color: s.color }))} />
            <DataTable caption="Mistakes per week" head={['Week', 'Total', ...stackKeys.map((s) => s.label)]} rows={weekly.map((w) => [shortWeek(String(w.week)), w.total, ...stackKeys.map((s) => (w[s.key] as number | undefined) ?? 0)])} />
          </Panel>
        )}

        <Panel
          title={`By ${breakCat?.label.toLowerCase() ?? 'category'}`}
          subtitle="Click a bar to see those mistakes."
          testId="breakdown-chart"
          actions={
            <select aria-label="Break down by" className="input h-8 w-auto py-0 text-xs" value={breakKey} onChange={(e) => setBreakKey(e.target.value)}>
              {config.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          }
        >
          {slices.length === 0 ? (
            <p className="text-sm text-ink-400">No mistakes have a {breakCat?.label.toLowerCase()} in this range.</p>
          ) : (
            <>
              <div style={{ height: Math.max(120, slices.length * 30 + 20) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slices} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" allowDecimals={false} stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" width={130} stroke="transparent" tick={{ fill: 'rgb(var(--ink-300))', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgb(var(--fg) / 0.05)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as (typeof slices)[number]
                      return <ChartTooltip title={d.label} value={`${d.count} mistake${d.count === 1 ? '' : 's'}`} swatch={d.color} />
                    }} />
                    <Bar dataKey="count" fill={PALETTE[0]} radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={22} cursor="pointer"
                      onClick={(d: { value?: string }) => { if (breakCat && d.value && d.value !== '__other') onSeeMistakes({ category: breakCat.key, value: d.value }) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable caption={`Mistakes by ${breakCat?.label ?? ''}`} head={[breakCat?.label ?? 'Value', 'Mistakes']} rows={slices.map((s) => [s.label, s.count])} />
            </>
          )}
        </Panel>

        <Panel title="Learned or just collected?" subtitle="All mistakes logged so far against the ones you have locked in." testId="mastery-chart">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mastery} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="week" tickFormatter={shortWeek} stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
                <YAxis allowDecimals={false} stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof mastery)[number]
                  return <ChartTooltip title={`Week of ${shortWeek(d.week)}`} value={`${d.logged} logged · ${d.locked} locked in`} />
                }} />
                <Line type="monotone" dataKey="logged" stroke={PALETTE[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="locked" stroke={PALETTE[2]} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Logged', color: PALETTE[0] }, { label: 'Locked in', color: PALETTE[2], dashed: true }]} />
          <DataTable caption="Logged versus locked in" head={['Week', 'Logged', 'Locked in']} rows={mastery.map((d) => [shortWeek(d.week), d.logged, d.locked])} />
        </Panel>

        <Panel title="Getting better, getting worse" subtitle={`By ${focusCat?.label.toLowerCase() ?? ''}: the last 2 weeks against the 2 before.`} testId="trends">
          {tr.worse.length === 0 && tr.better.length === 0 ? (
            <p className="text-sm text-ink-400">Not enough recent mistakes to compare yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="eyebrow mb-2">More mistakes</p>
                <ul className="space-y-1.5 text-sm">
                  {tr.worse.map((t) => <li key={t.value} className="flex items-center justify-between gap-2 text-ink-100"><span>{t.label}</span><span className="flex items-center gap-1 font-mono text-xs tabular-nums text-ink-300"><ArrowUpRight className="h-3.5 w-3.5 text-rose-300" aria-label="up" />{t.previous} → {t.recent}</span></li>)}
                  {tr.worse.length === 0 && <li className="text-xs text-ink-500">Nothing is getting worse.</li>}
                </ul>
              </div>
              <div>
                <p className="eyebrow mb-2">Fewer mistakes</p>
                <ul className="space-y-1.5 text-sm">
                  {tr.better.map((t) => <li key={t.value} className="flex items-center justify-between gap-2 text-ink-100"><span>{t.label}</span><span className="flex items-center gap-1 font-mono text-xs tabular-nums text-ink-300"><ArrowDownRight className="h-3.5 w-3.5 text-brand-300" aria-label="down" />{t.previous} → {t.recent}</span></li>)}
                  {tr.better.length === 0 && <li className="text-xs text-ink-500">No improvements yet.</li>}
                </ul>
              </div>
            </div>
          )}
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={() => onReview(null)} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}>Start the weekly review</Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default MistakeDashboard
