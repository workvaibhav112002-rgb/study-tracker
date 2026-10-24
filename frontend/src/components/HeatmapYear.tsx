import React, { useMemo, useState } from 'react'
import type { DailyStat } from '../types'
import { LEVEL_COLORS, buildHeatmap, formatHeatDate, type HeatmapCell } from '../lib/heatmap'
import { formatMinutes } from '../lib/time'
import { ChartTooltip } from './ui/ChartTooltip'

const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const LEFT = 28
const TOP = 18
const DAY_LABELS: Record<number, string> = { 0: 'Mon', 2: 'Wed', 4: 'Fri' }

interface Props {
  days: DailyStat[]
  end?: Date
}

export const HeatmapYear: React.FC<Props> = ({ days, end }) => {
  const model = useMemo(() => buildHeatmap(days, end), [days, end])
  const [hover, setHover] = useState<HeatmapCell | null>(null)
  const width = LEFT + model.weeks * STEP
  const height = TOP + 7 * STEP
  const total = days.reduce((s, d) => s + d.minutes, 0)
  const active = days.filter((d) => d.minutes > 0).length

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-xs text-ink-500">
          <span className="font-semibold text-ink-100">{formatMinutes(total)}</span> over{' '}
          <span className="font-semibold text-ink-100">{active}</span> active days
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-500" aria-hidden="true">
          Less
          {LEVEL_COLORS.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          More
        </div>
      </div>
      <div className="relative overflow-x-auto pb-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="grid"
          aria-label="Study minutes per day over the last year"
          className="block"
          onMouseLeave={() => setHover(null)}
        >
          {model.monthLabels.map((m) => (
            <text key={`${m.col}-${m.label}`} x={LEFT + m.col * STEP} y={11} className="fill-ink-500" fontSize={10}>
              {m.label}
            </text>
          ))}
          {Object.entries(DAY_LABELS).map(([row, label]) => (
            <text key={row} x={0} y={TOP + Number(row) * STEP + CELL - 2} className="fill-ink-600" fontSize={9}>
              {label}
            </text>
          ))}
          {model.cells.map((c) => {
            const x = LEFT + c.col * STEP
            const y = TOP + c.row * STEP
            return (
              <g key={c.date} role="gridcell" aria-label={`${formatHeatDate(c.date)}: ${formatMinutes(c.minutes)}`}>
                <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={LEVEL_COLORS[c.level]} />
                <rect
                  x={x - GAP / 2}
                  y={y - GAP / 2}
                  width={STEP}
                  height={STEP}
                  fill="transparent"
                  tabIndex={-1}
                  onMouseEnter={() => setHover(c)}
                  onFocus={() => setHover(c)}
                >
                  <title>{`${formatHeatDate(c.date)}: ${formatMinutes(c.minutes)}`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10"
            style={{ left: Math.min(width - 160, LEFT + hover.col * STEP - 60), top: TOP + hover.row * STEP + STEP + 4 }}
          >
            <ChartTooltip title={formatHeatDate(hover.date)} value={hover.minutes > 0 ? formatMinutes(hover.minutes) : 'No study time'} />
          </div>
        )}
      </div>
    </div>
  )
}
