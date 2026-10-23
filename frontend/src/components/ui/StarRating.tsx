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
  const dim = size === 'md' ? 'w-6 h-6' : 'w-5 h-5'

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
    <div className="flex items-center space-x-2">
      <div role="radiogroup" aria-label={label} className="flex items-center space-x-1" onKeyDown={onKeyDown}>
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
            className="p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            <Star className={`${dim} transition-colors ${shown >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
          </button>
        ))}
      </div>
      {showLabel && <span className="text-xs text-slate-400 ml-2 font-medium">{RATING_LABELS[shown] ?? ''}</span>}
    </div>
  )
}
