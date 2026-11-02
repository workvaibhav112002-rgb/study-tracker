import type { ExamTemplate, Mock, MockSection } from '../types'

/**
 * Mirror of backend/internal/httpapi/scoring.go. The server uses it for the
 * Excel export; the browser uses it for live previews and charts. Keep the
 * two in step (scoring.test.ts holds the shared cases).
 */
export const DEFAULT_ACCURACY_THRESHOLD = 85
export const DEFAULT_PENALTY_LIMIT = 2.5

export interface SectionScore {
  name: string
  attempted: number
  net: number
  penalty: number
  accuracy: number
  attemptRate: number
  maxMarks: number
  seconds: number
  lowAccuracy: boolean
  highPenalty: boolean
}

export interface MockScore {
  sections: SectionScore[]
  net: number
  penalty: number
  maxMarks: number
  accuracy: number
  attemptRate: number
}

const round2 = (v: number) => Math.round(v * 100) / 100
const pct = (n: number, d: number) => (d > 0 ? round2((n / d) * 100) : 0)

export function scoreSection(s: MockSection, accuracyThreshold = DEFAULT_ACCURACY_THRESHOLD, penaltyLimit = DEFAULT_PENALTY_LIMIT): SectionScore {
  const attempted = s.correct + s.incorrect
  const penalty = s.incorrect * s.negative_each
  const accuracy = pct(s.correct, attempted)
  const roundedPenalty = round2(penalty)
  return {
    name: s.name,
    attempted,
    net: round2(s.correct * s.marks_each - penalty),
    penalty: roundedPenalty,
    accuracy,
    attemptRate: pct(attempted, s.questions),
    maxMarks: round2(s.questions * s.marks_each),
    seconds: s.seconds,
    lowAccuracy: attempted > 0 && accuracy < accuracyThreshold,
    highPenalty: roundedPenalty > penaltyLimit,
  }
}

export function thresholds(t: ExamTemplate | null | undefined) {
  return {
    accuracy: t && t.accuracy_threshold > 0 ? t.accuracy_threshold : DEFAULT_ACCURACY_THRESHOLD,
    penalty: t && t.penalty_limit > 0 ? t.penalty_limit : DEFAULT_PENALTY_LIMIT,
  }
}

export function scoreMock(m: Pick<Mock, 'sections'>, t?: ExamTemplate | null): MockScore {
  const th = thresholds(t)
  const sections = m.sections.map((s) => scoreSection(s, th.accuracy, th.penalty))
  let correct = 0
  let attempted = 0
  let questions = 0
  m.sections.forEach((s) => {
    correct += s.correct
    attempted += s.correct + s.incorrect
    questions += s.questions
  })
  return {
    sections,
    net: round2(sections.reduce((a, s) => a + s.net, 0)),
    penalty: round2(sections.reduce((a, s) => a + s.penalty, 0)),
    maxMarks: round2(sections.reduce((a, s) => a + s.maxMarks, 0)),
    accuracy: pct(correct, attempted),
    attemptRate: pct(attempted, questions),
  }
}
