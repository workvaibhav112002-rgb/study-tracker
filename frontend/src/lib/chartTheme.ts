export const GRID = 'rgb(var(--fg) / 0.08)'
export const AXIS = 'rgb(var(--ink-500))'
export const SURFACE = 'rgb(var(--surface-900))'

export const shortWeek = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
