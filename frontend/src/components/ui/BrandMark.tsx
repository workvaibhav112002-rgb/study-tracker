import React from 'react'

/** Meridian mark: the sun at its highest point above the horizon. */
export const BrandGlyph: React.FC<{ className?: string; strokeWidth?: number }> = ({ className = 'h-[18px] w-[18px]', strokeWidth = 2.2 }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2.5v2.5" />
    <path d="M5.3 5.8l1.6 1.6" />
    <path d="M18.7 5.8l-1.6 1.6" />
    <path d="M7.5 15.5a4.5 4.5 0 0 1 9 0" />
    <path d="M3 15.5h18" />
    <path d="M7 19.5h10" />
  </svg>
)
