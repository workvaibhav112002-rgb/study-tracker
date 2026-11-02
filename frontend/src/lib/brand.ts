/**
 * The product name and pitch, in one place. Renaming the product is a change
 * here and in backend/internal/brand/brand.go (plus the icons script). The
 * vite config reads this file for the PWA manifest and index.html.
 * Internal ids (storage keys, JWT issuer) keep the original id on purpose.
 */
export const BRAND = {
  name: 'Granule',
  tagline: 'Small moments, big results.',
  description: 'A focus timer that finds the micro-moments that make or break deep work.',
  filePrefix: 'granule',
} as const

export const pageTitle = (prefix?: string) => (prefix ? `${prefix} · ${BRAND.name}` : `${BRAND.name} · Focus timer`)
