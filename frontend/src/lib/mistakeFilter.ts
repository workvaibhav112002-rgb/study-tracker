import type { Mistake, MistakeStatus, RootCause } from '../types'

export interface MistakeFilterState {
  subject: string
  pattern: string
  rootCause: RootCause | ''
  mockId: number | ''
  status: MistakeStatus | ''
  q: string
}

export const EMPTY_FILTER: MistakeFilterState = { subject: '', pattern: '', rootCause: '', mockId: '', status: '', q: '' }

export function applyMistakeFilter(list: Mistake[], f: MistakeFilterState): Mistake[] {
  const q = f.q.trim().toLowerCase()
  return list.filter(
    (m) =>
      (!f.subject || m.subject === f.subject) &&
      (!f.pattern || m.pattern === f.pattern) &&
      (!f.rootCause || m.root_cause === f.rootCause) &&
      (f.mockId === '' || m.mock_id === f.mockId) &&
      (!f.status || m.status === f.status) &&
      (!q || [m.question, m.rule, m.solution, m.pattern, m.subject].some((t) => t.toLowerCase().includes(q))),
  )
}

