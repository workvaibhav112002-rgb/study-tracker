import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, Award, Trophy } from 'lucide-react'
import { LEVEL_COLORS, buildHeatmap } from '../../lib/heatmap'
import { dashOffset, ringGeometry } from '../../lib/ring'
import { formatClock } from '../../lib/time'
import { renderShareCard } from '../../lib/shareCard'
import { EXAMPLE_DAYS, EXAMPLE_END, EXAMPLE_SHARE, EXAMPLE_STREAK_DAYS, countUp, heatmapRevealCount } from '../../lib/tour'

/** Each scene takes progress 0..1 and renders a frame; progress 1 is the final frame. */
export interface SceneProps {
  progress: number
}

const RADIUS = 72
const STROKE = 8
const { size: SIZE, circumference: CIRC } = ringGeometry(RADIUS, STROKE)

export const TimerScene: React.FC<SceneProps> = ({ progress }) => {
  const total = 25 * 60
  const left = total - Math.round(progress * 95)
  return (
    <div className="flex items-center justify-center" style={{ height: 220 }}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <span aria-hidden="true" className="absolute inset-4 rounded-full bg-brand-500/25 blur-2xl animate-breathe" />
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative -rotate-90" aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-fg/[0.06]" />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} strokeLinecap="round" stroke="rgb(var(--brand-400))" strokeDasharray={CIRC} strokeDashoffset={dashOffset(CIRC, 0.06 + progress * 0.3)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-semibold tabular-nums text-ink-50">{formatClock(left)}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-300">Focus · cycle 2</span>
        </div>
      </div>
    </div>
  )
}

export const HeatmapScene: React.FC<SceneProps> = ({ progress }) => {
  const model = useMemo(() => buildHeatmap(EXAMPLE_DAYS, EXAMPLE_END, 18), [])
  const shown = heatmapRevealCount(progress, model.cells.length)
  const cell = 14
  const gap = 3
  const width = model.weeks * (cell + gap)
  const height = 7 * (cell + gap)
  return (
    <div className="flex items-center justify-center" style={{ height: 220 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {model.cells.map((c, i) => (
          <rect key={c.date} x={c.col * (cell + gap)} y={c.row * (cell + gap)} width={cell} height={cell} rx={3} fill={i < shown ? LEVEL_COLORS[c.level] : LEVEL_COLORS[0]} style={{ transition: 'fill 200ms' }} />
        ))}
      </svg>
    </div>
  )
}

export const StreakScene: React.FC<SceneProps> = ({ progress }) => {
  const n = countUp(progress, EXAMPLE_STREAK_DAYS)
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: 220 }}>
      <span className={`flex h-16 w-16 items-center justify-center rounded-3xl border border-orange-400/20 bg-orange-400/10 text-orange-400 ${progress > 0.1 ? 'animate-scale-in' : 'opacity-0'}`}>
        <Flame className="h-8 w-8 fill-current" aria-hidden="true" />
      </span>
      <div className="text-center">
        <span key={n} className="block font-mono text-6xl font-semibold tabular-nums text-ink-50 animate-count">{n}</span>
        <span className="eyebrow">day goal streak</span>
      </div>
      <span className="chip border-sky-400/20 bg-sky-400/10 text-sky-200" style={{ opacity: progress > 0.8 ? 1 : 0, transition: 'opacity 300ms' }}>
        1 freeze available this week
      </span>
    </div>
  )
}

export const BadgeScene: React.FC<SceneProps> = ({ progress }) => {
  const unlocked = progress > 0.25
  return (
    <div className="flex items-center justify-center" style={{ height: 220 }}>
      <div className={`card flex w-64 flex-col items-center p-6 text-center transition-all duration-500 ${unlocked ? 'border-brand-500/40 bg-brand-500/10 shadow-glow' : ''}`}>
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${unlocked ? 'border-brand-400/30 bg-brand-400/15 text-brand-300 animate-scale-in' : 'border-fg/[0.06] bg-fg/[0.04] text-ink-500'}`}>
          {unlocked ? <Trophy className="h-7 w-7" aria-hidden="true" /> : <Award className="h-7 w-7" aria-hidden="true" />}
        </span>
        <p className="mt-4 text-[15px] font-semibold text-ink-50">Fifty hours</p>
        <p className="mt-1 text-xs text-ink-500">Study for 50 hours in total</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.06]">
          <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${Math.min(100, 92 + progress * 8)}%` }} />
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-300" style={{ opacity: unlocked ? 1 : 0, transition: 'opacity 300ms' }}>
          Unlocked
        </p>
      </div>
    </div>
  )
}

export const ShareScene: React.FC<SceneProps> = ({ progress }) => {
  const [src, setSrc] = useState<string | null>(null)
  const rendered = useRef(false)
  useEffect(() => {
    if (rendered.current) return
    rendered.current = true
    try {
      const canvas = document.createElement('canvas')
      if (renderShareCard(canvas, EXAMPLE_SHARE)) setSrc(canvas.toDataURL('image/png'))
    } catch {
      /* no canvas in this environment */
    }
  }, [])
  return (
    <div className="flex items-center justify-center" style={{ height: 220 }}>
      {src ? (
        <img src={src} alt="Example share card with a week of study numbers" width={360} height={189} className="rounded-2xl border border-fg/[0.08] shadow-card" style={{ transform: `translateY(${(1 - Math.min(1, progress * 3)) * 12}px)`, opacity: Math.min(1, progress * 3), transition: 'transform 300ms, opacity 300ms' }} />
      ) : (
        <div className="card flex h-[189px] w-[360px] items-center justify-center text-sm text-ink-500">Share card preview</div>
      )}
    </div>
  )
}
