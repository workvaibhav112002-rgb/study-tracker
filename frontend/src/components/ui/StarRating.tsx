import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { RATING_LABELS } from '../../lib/rating'

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  size?: 'sm' | 'md'
  label?: string
  showLabel?: boolean
}

/** Keyboard-accessible 1–5 rating implemented as a radiogroup. */
export const StarRating: React.FC<StarRatingProps> = ({ value, onChange, size = 'md', label = 'Focus rating', showLabel = true }) => {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const dim = size === 'md' ? 'h-6 w-6' : 'h-5 w-5'

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(5, value + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(1, value - 1))
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5" onKeyDown={onKeyDown}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            tabIndex={value === star ? 0 : -1}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="focus-ring rounded-md p-1 transition-transform duration-150 hover:scale-110"
          >
            <Star
              className={`${dim} transition-colors duration-150 ${shown >= star ? 'fill-accent-amber text-accent-amber drop-shadow-[0_0_6px_rgb(245_182_61/0.5)]' : 'text-ink-700'}`}
            />
          </button>
        ))}
      </div>
      {showLabel && <span className="text-xs font-medium text-ink-400">{RATING_LABELS[shown] ?? ''}</span>}
    </div>
  )
}
