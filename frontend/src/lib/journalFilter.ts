import type { Mistake, MistakeStatus } from '../types'
import { tagValues } from './journal'

export interface JournalFilter {
  tags: Record<string, string>
  status: MistakeStatus | ''
  testId: number | ''
  q: string
  ids?: number[]
  idsLabel?: string
}

export const EMPTY_JOURNAL_FILTER: JournalFilter = { tags: {}, status: '', testId: '', q: '' }

export function applyJournalFilter(list: Mistake[], f: JournalFilter): Mistake[] {
  const q = f.q.trim().toLowerCase()
  const ids = f.ids ? new Set(f.ids) : null
  return list.filter(
    (m) =>
      (!ids || ids.has(m.id)) &&
      Object.entries(f.tags).every(([k, v]) => !v || tagValues(m, k).includes(v)) &&
      (f.testId === '' || m.mock_id === f.testId) &&
      (!f.status || m.status === f.status) &&
      (!q || [m.question, m.rule, m.solution, ...Object.values(m.tags).flat(), ...Object.values(m.extra).map(String)].some((t) => t.toLowerCase().includes(q))),
  )
}

