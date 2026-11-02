import { describe, expect, it } from 'vitest'
import { scoreMock, scoreSection } from './scoring'

const sec = (questions: number, correct: number, incorrect: number, marks = 1, neg = 0.25) => ({ name: 'S', questions, correct, incorrect, seconds: 0, marks_each: marks, negative_each: neg })

// Same cases as TestScoreSection in backend/internal/httpapi/mocks_test.go.
describe('scoreSection', () => {
  it.each([
    ['clean', sec(35, 30, 0), 30, 0, 100, 85.71, false, false],
    ['negatives', sec(35, 20, 11), 17.25, 2.75, 64.52, 88.57, true, true],
    ['at threshold', sec(20, 17, 3), 16.25, 0.75, 85, 100, false, false],
    ['penalty exactly limit', sec(40, 30, 10), 27.5, 2.5, 75, 100, true, false],
    ['nothing attempted', sec(30, 0, 0, 2, 0.5), 0, 0, 0, 0, false, false],
  ])('%s', (_name, s, net, penalty, acc, attempt, low, high) => {
    const got = scoreSection(s, 85, 2.5)
    expect(got).toMatchObject({ net, penalty, accuracy: acc, attemptRate: attempt, lowAccuracy: low, highPenalty: high })
  })
})

describe('scoreMock', () => {
  it('totals sections and honours template thresholds', () => {
    const m = { sections: [{ ...sec(35, 20, 11), name: 'Quant' }, { ...sec(30, 25, 1), name: 'English' }] }
    const total = scoreMock(m, { key: '', sections: [], negative_fraction: 0.25, target_score: 0, accuracy_threshold: 60, penalty_limit: 3 })
    expect(total.net).toBe(42)
    expect(total.penalty).toBe(3)
    expect(total.maxMarks).toBe(65)
    expect(total.sections[0].lowAccuracy).toBe(false)
    expect(total.sections[0].highPenalty).toBe(false)
  })
  it('uses the 85% / 2.5 mark defaults without a template', () => {
    const total = scoreMock({ sections: [sec(35, 20, 11)] })
    expect(total.sections[0].lowAccuracy).toBe(true)
    expect(total.sections[0].highPenalty).toBe(true)
  })
})
