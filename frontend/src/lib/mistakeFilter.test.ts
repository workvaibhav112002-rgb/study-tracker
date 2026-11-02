import { describe, expect, it } from 'vitest'
import type { Mistake } from '../types'
import { EMPTY_FILTER, applyMistakeFilter } from './mistakeFilter'

const m = (over: Partial<Mistake>): Mistake => ({
  id: 1, project_id: 1, mock_id: null, subject: 'Reasoning', pattern: 'Puzzle: Box', root_cause: 'time_ego', question: 'Box puzzle with 7 boxes', rule: '', solution: '',
  actual_seconds: null, ideal_seconds: null, status: 'active', last_reviewed_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
})

describe('applyMistakeFilter', () => {
  const list = [m({ id: 1 }), m({ id: 2, subject: 'Quant', pattern: 'DI: Tabular', root_cause: 'procedural', mock_id: 9, status: 'locked_in' }), m({ id: 3, root_cause: 'concept', rule: 'Draw the **grid** first' })]
  it('combines filters', () => {
    expect(applyMistakeFilter(list, EMPTY_FILTER).map((x) => x.id)).toEqual([1, 2, 3])
    expect(applyMistakeFilter(list, { ...EMPTY_FILTER, subject: 'Reasoning', rootCause: 'time_ego' }).map((x) => x.id)).toEqual([1])
    expect(applyMistakeFilter(list, { ...EMPTY_FILTER, mockId: 9 }).map((x) => x.id)).toEqual([2])
    expect(applyMistakeFilter(list, { ...EMPTY_FILTER, status: 'locked_in' }).map((x) => x.id)).toEqual([2])
    expect(applyMistakeFilter(list, { ...EMPTY_FILTER, q: 'GRID' }).map((x) => x.id)).toEqual([3])
  })
})
