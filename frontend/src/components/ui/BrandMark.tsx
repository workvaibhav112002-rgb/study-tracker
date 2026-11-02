import React from 'react'

/**
 * Granule mark: a loose cluster of grains, one larger than the rest. Small
 * moments, looked at closely. Also the source for scripts/brand-icons.mjs.
 */
export const BRAND_GLYPH_PATHS = `<circle cx="12" cy="12.2" r="3.7"/><circle cx="5.9" cy="8.9" r="2"/><circle cx="17.8" cy="7.6" r="1.6"/><circle cx="7.6" cy="17.4" r="1.6"/><circle cx="16.8" cy="16.9" r="2.3"/><circle cx="11.6" cy="4.6" r="1.2"/><circle cx="20" cy="12.9" r="1.1"/><circle cx="3.9" cy="14.6" r="1"/>`

export const BrandGlyph: React.FC<{ className?: string; strokeWidth?: number }> = ({ className = 'h-[18px] w-[18px]', strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none" strokeWidth={strokeWidth} aria-hidden="true" dangerouslySetInnerHTML={{ __html: BRAND_GLYPH_PATHS }} />
)
