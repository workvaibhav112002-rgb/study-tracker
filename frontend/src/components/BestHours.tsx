import React from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Sunrise } from 'lucide-react'
import type { HourStat } from '../types'
import { formatMinutes } from '../lib/time'
import { ChartTooltip } from './ui/ChartTooltip'

const GRID = 'rgb(var(--fg) / 0.08)'
const AXIS = 'rgb(var(--ink-500))'

const hourLabel = (h: number) => `${h.toString().padStart(2, '0')}:00`

export const BestHours: React.FC<{ hours: HourStat[] }> = ({ hours }) => {
  const top = [...hours].filter((h) => h.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 3).map((h) => h.hour)
  const peak = hours.find((h) => h.hour === top[0])
  if (!peak) {
    return (
      <div className="flex h-56 flex-col items-center justify-center text-xs text-ink-500">
        <Sunrise className="mb-2 h-7 w-7 text-ink-700" aria-hidden="true" />
        Log a few sessions to find your best hours
      </div>
    )
  }
  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        You focus best around <span className="font-semibold text-ink-100">{hourLabel(peak.hour)}</span>
        {peak.avg_rating > 0 && (
          <>
            , averaging <span className="font-semibold text-ink-100">{peak.avg_rating.toFixed(1)}/5</span> focus
          </>
        )}
        .
      </p>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hours} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="hour" tickFormatter={(h: number) => (h % 3 === 0 ? `${h}h` : '')} interval={0} stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis stroke="transparent" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} unit="m" />
            <Tooltip
              cursor={{ fill: 'rgb(var(--fg) / 0.05)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as HourStat
                return <ChartTooltip title={`${hourLabel(d.hour)} – ${hourLabel((d.hour + 1) % 24)}`} value={`${formatMinutes(d.minutes)} · ${d.session_count} session${d.session_count === 1 ? '' : 's'}`} />
              }}
            />
            <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {hours.map((h) => (
                <Cell key={h.hour} fill={top.includes(h.hour) ? 'rgb(var(--brand-400))' : 'rgb(var(--brand-400) / 0.35)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
