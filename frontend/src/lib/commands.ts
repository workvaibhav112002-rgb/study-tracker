/** Command palette model: pure, so it is testable without React. */
export interface Command {
  id: string
  label: string
  hint?: string
  keywords?: string
  group: 'Navigate' | 'Timer' | 'Projects' | 'Actions'
  run: () => void
}

/** Simple subsequence scoring: lower is better, null means no match. */
export function scoreCommand(query: string, c: Command): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const hay = `${c.label} ${c.keywords ?? ''}`.toLowerCase()
  if (hay.includes(q)) return hay.indexOf(q)
  let i = 0
  let score = 0
  for (const ch of hay) {
    if (ch === q[i]) {
      i++
      if (i === q.length) return 100 + score
    } else if (i > 0) {
      score++
    }
  }
  return null
}

export function filterCommands(query: string, commands: Command[]): Command[] {
  return commands
    .map((c) => ({ c, s: scoreCommand(query, c) }))
    .filter((x): x is { c: Command; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s)
    .map((x) => x.c)
}
