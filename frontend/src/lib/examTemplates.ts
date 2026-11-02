import type { ExamTemplate, MockSection, RootCause, MistakeStatus } from '../types'

export interface ExamPreset {
  key: string
  label: string
  template: ExamTemplate
}

const banking = (key: string, target: number): ExamTemplate => ({
  key,
  sections: [
    { name: 'English', questions: 30, marks_each: 1, minutes: 20 },
    { name: 'Quant', questions: 35, marks_each: 1, minutes: 20 },
    { name: 'Reasoning', questions: 35, marks_each: 1, minutes: 20 },
  ],
  negative_fraction: 0.25,
  target_score: target,
  accuracy_threshold: 85,
  penalty_limit: 2.5,
})

/**
 * Starting points only. Exam patterns change between notifications, so every
 * field stays editable and the UI asks the user to check the latest one.
 */
export const EXAM_PRESETS: ExamPreset[] = [
  { key: 'ibps-po-pre', label: 'IBPS PO Prelims', template: banking('ibps-po-pre', 60) },
  { key: 'sbi-po-pre', label: 'SBI PO Prelims', template: banking('sbi-po-pre', 60) },
  { key: 'ibps-clerk-pre', label: 'IBPS Clerk Prelims', template: banking('ibps-clerk-pre', 75) },
  {
    key: 'nicl-ao-pre',
    label: 'NICL AO Prelims',
    template: {
      ...banking('nicl-ao-pre', 75),
      sections: [
        { name: 'Reasoning', questions: 35, marks_each: 1, minutes: 20 },
        { name: 'English', questions: 30, marks_each: 1, minutes: 20 },
        { name: 'Quant', questions: 35, marks_each: 1, minutes: 20 },
      ],
    },
  },
  {
    key: 'ssc-cgl-t1',
    label: 'SSC CGL Tier 1',
    template: {
      key: 'ssc-cgl-t1',
      sections: [
        { name: 'Reasoning', questions: 25, marks_each: 2, minutes: 15 },
        { name: 'General Awareness', questions: 25, marks_each: 2, minutes: 15 },
        { name: 'Quant', questions: 25, marks_each: 2, minutes: 15 },
        { name: 'English', questions: 25, marks_each: 2, minutes: 15 },
      ],
      negative_fraction: 0.25,
      target_score: 140,
      accuracy_threshold: 85,
      penalty_limit: 5,
    },
  },
  {
    key: 'so-pk-mains',
    label: 'Specialist / Technical Officer (Professional Knowledge)',
    template: {
      key: 'so-pk-mains',
      sections: [{ name: 'Professional Knowledge', questions: 60, marks_each: 1, minutes: 45 }],
      negative_fraction: 0.25,
      target_score: 40,
      accuracy_threshold: 85,
      penalty_limit: 2.5,
    },
  },
  {
    key: 'custom',
    label: 'Custom exam',
    template: {
      key: 'custom',
      sections: [{ name: 'Section 1', questions: 30, marks_each: 1, minutes: 20 }],
      negative_fraction: 0.25,
      target_score: 0,
      accuracy_threshold: 85,
      penalty_limit: 2.5,
    },
  },
]

/** Fallback when a project has no exam template yet. */
export const DEFAULT_TEMPLATE = EXAM_PRESETS[0].template

export function presetFor(key: string): ExamPreset | undefined {
  return EXAM_PRESETS.find((p) => p.key === key)
}

/** Blank mock sections laid out from a template. */
export function sectionsFromTemplate(t: ExamTemplate): MockSection[] {
  return t.sections.map((s) => ({
    name: s.name,
    questions: s.questions,
    correct: 0,
    incorrect: 0,
    seconds: s.minutes * 60,
    marks_each: s.marks_each,
    negative_each: Math.round(s.marks_each * t.negative_fraction * 100) / 100,
  }))
}

// ---- Mistake taxonomy ----

export const SUBJECTS = ['Quant', 'Reasoning', 'English', 'Professional Knowledge'] as const

export const PATTERNS: Record<string, string[]> = {
  Quant: [
    'Speed Math: Quadratics',
    'Speed Math: Series',
    'Speed Math: Simplification',
    'DI: Tabular',
    'DI: Caselet',
    'DI: Pie / Bar',
    'Arithmetic: Ratio based',
    'Arithmetic: Percentage traps',
  ],
  Reasoning: [
    'Syllogism',
    'Inequality',
    'Coding-Decoding',
    'Puzzle: Box',
    'Puzzle: Floor-Flat',
    'Puzzle: Scheduling',
    'Seating: Linear (N/S)',
    'Seating: Circular (in/out)',
  ],
  English: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Para jumbles', 'Cloze test'],
  'Professional Knowledge': ['Networking', 'DBMS', 'Operating Systems', 'Data Structures', 'Security'],
}

export const ROOT_CAUSES: { value: RootCause; label: string; short: string; help: string }[] = [
  { value: 'concept', label: 'Concept gap', short: 'Concept', help: 'Did not know the formula, rule or logical condition.' },
  { value: 'procedural', label: 'Calculation / procedural', short: 'Silly', help: 'Knew the method but misread units, lost a sign or slipped on mental math.' },
  { value: 'time_ego', label: 'Time panic / ego trap', short: 'Ego trap', help: 'Ignored the 45-second bail-out and forced a stubborn question.' },
]

export const rootCauseLabel = (r: RootCause) => ROOT_CAUSES.find((c) => c.value === r)?.label ?? r

export const STATUS_LABELS: Record<MistakeStatus, string> = {
  active: 'New',
  locked_in: 'Locked in',
  review_next_week: 'Review next week',
  needs_drill: 'Needs concept drill',
}

/** Symbols for the execution-rule box (typed at the cursor). */
export const RULE_SYMBOLS = ['×', '÷', '±', '√', '²', '³', '≈', '≠', '≤', '≥', '→', '%', 'π', '∴', '∵', 'Δ']
