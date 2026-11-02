import { describe, expect, it } from 'vitest'
import type { Mistake } from '../types'
import { EMPTY_JOURNAL_FILTER, applyJournalFilter } from './journalFilter'

const m = (id: number, tags: Mistake['tags'], over: Partial<Mistake> = {}): Mistake => ({
  id, project_id: 1, mock_id: null, tags, extra: {}, question: '', rule: '', solution: '', actual_seconds: null, ideal_seconds: null,
  status: 'active', last_reviewed_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
})

describe('applyJournalFilter', () => {
  const list = [m(1, { topic: 'Fractions', mistake_type: 'careless' }), m(2, { topic: 'Algebra', chapter: ['3', '4'] }, { mock_id: 9, status: 'locked_in' }), m(3, { topic: 'Fractions' }, { rule: 'Draw the **grid**', extra: { page: 12 } })]
  it('combines category, test, status, text and id filters', () => {
    expect(applyJournalFilter(list, EMPTY_JOURNAL_FILTER).map((x) => x.id)).toEqual([1, 2, 3])
    expect(applyJournalFilter(list, { ...EMPTY_JOURNAL_FILTER, tags: { topic: 'Fractions', mistake_type: 'careless' } }).map((x) => x.id)).toEqual([1])
    expect(applyJournalFilter(list, { ...EMPTY_JOURNAL_FILTER, tags: { chapter: '4' } }).map((x) => x.id)).toEqual([2])
    expect(applyJournalFilter(list, { ...EMPTY_JOURNAL_FILTER, testId: 9, status: 'locked_in' }).map((x) => x.id)).toEqual([2])
    expect(applyJournalFilter(list, { ...EMPTY_JOURNAL_FILTER, q: 'GRID' }).map((x) => x.id)).toEqual([3])
    expect(applyJournalFilter(list, { ...EMPTY_JOURNAL_FILTER, q: '12' }).map((x) => x.id)).toEqual([3])
    expect(applyJournalFilter(list, { ...EMPTY_JOURNAL_FILTER, ids: [1, 2] }).map((x) => x.id)).toEqual([1, 2])
  })
})
