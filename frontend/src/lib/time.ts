/** Formats whole seconds as MM:SS. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/** 95 → "1h 35m", 40 → "40m". */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(m / 60)
  const rem = m % 60
  return h === 0 ? `${rem}m` : `${h}h ${rem}m`
}

/** Seconds → "25m" / "1h 5m". */
export function formatDurationSeconds(seconds: number): string {
  return formatMinutes(seconds / 60)
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parses YYYY-MM-DD into a local Date at the given hour. */
export function localDateAt(yyyyMmDd: string, hour = 12): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The viewer's IANA timezone, falling back to UTC. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
