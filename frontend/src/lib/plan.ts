/** Exam countdown and planned-versus-actual helpers. */
export function daysUntil(dateISO: string | null | undefined, now = new Date()): number | null {
  if (!dateISO) return null
  const [y, m, d] = dateISO.split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export type PlanStatus = 'ahead' | 'on-track' | 'behind' | 'none'

/** Compares the rolling week against the planned weekly hours. */
export function planStatus(weekMinutes: number | undefined, plannedHours: number | null | undefined): { status: PlanStatus; percent: number } {
  if (!plannedHours || plannedHours <= 0) return { status: 'none', percent: 0 }
  const pct = Math.round(((weekMinutes ?? 0) / (plannedHours * 60)) * 100)
  if (pct >= 110) return { status: 'ahead', percent: pct }
  if (pct >= 85) return { status: 'on-track', percent: pct }
  return { status: 'behind', percent: pct }
}
