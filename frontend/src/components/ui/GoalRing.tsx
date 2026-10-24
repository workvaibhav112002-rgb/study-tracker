import React from 'react'
import { Check } from 'lucide-react'
import { dashOffset, goalFraction, ringGeometry } from '../../lib/ring'

interface GoalRingProps {
  today: number
  target: number
  color?: string
  size?: number
}

/** Small progress ring for a project's daily goal. */
export const GoalRing: React.FC<GoalRingProps> = ({ today, target, color = '#34d399', size = 56 }) => {
  const stroke = 5
  const radius = size / 2 - stroke
  const { circumference } = ringGeometry(radius, stroke)
  const fraction = goalFraction(today, target)
  const met = fraction >= 1
  return (
    <div
      role="img"
      aria-label={`${Math.round(today)} of ${target} minutes today`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} className="stroke-fg/[0.06]" strokeWidth={stroke} fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset(circumference, fraction)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)', filter: met ? `drop-shadow(0 0 6px ${color})` : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {met ? (
          <Check className="h-4 w-4" style={{ color }} aria-hidden="true" />
        ) : (
          <span className="font-mono text-[11px] font-semibold tabular-nums text-ink-100">{Math.round(fraction * 100)}%</span>
        )}
      </div>
    </div>
  )
}
