/** Geometry helpers shared by the timer ring and goal rings. */
export function ringGeometry(radius: number, stroke: number): { size: number; circumference: number } {
  return { size: (radius + stroke) * 2, circumference: 2 * Math.PI * radius }
}

export function dashOffset(circumference: number, fraction: number): number {
  const f = Math.max(0, Math.min(1, fraction))
  return circumference - f * circumference
}

export function goalFraction(todayMinutes: number, targetMinutes: number): number {
  if (targetMinutes <= 0) return 0
  return Math.max(0, Math.min(1, todayMinutes / targetMinutes))
}
