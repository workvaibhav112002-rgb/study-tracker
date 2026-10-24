import React from 'react'

/** Shimmering placeholder block; pass sizing via className. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`animate-breathe rounded-xl bg-fg/[0.05] ${className}`} />
)
