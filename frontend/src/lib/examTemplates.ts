import type { ExamTemplate, MockSection } from '../types'

export interface ExamPreset {
  key: string
  label: string
  template: ExamTemplate
  competitive?: boolean
}

const single = (key: string, name: string, questions: number, minutes: number, target: number): ExamTemplate => ({
  key,
  sections: [{ name, questions, marks_each: 1, minutes }],
  negative_fraction: 0,
  target_score: target,
  accuracy_threshold: 85,
  penalty_limit: 2.5,
})

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
  { key: 'simple', label: 'Simple score (out of 100)', template: single('simple', 'Score', 100, 0, 0) },
  { key: 'paper', label: 'School or university exam', template: single('paper', 'Paper', 50, 90, 35) },
  { key: 'certification', label: 'Certification (multiple choice)', template: single('certification', 'Questions', 65, 130, 47) },
  {
    key: 'language',
    label: 'Language test (4 skills)',
    template: {
      key: 'language',
      sections: ['Reading', 'Listening', 'Writing', 'Speaking'].map((name) => ({ name, questions: 25, marks_each: 1, minutes: 30 })),
      negative_fraction: 0,
      target_score: 70,
      accuracy_threshold: 80,
      penalty_limit: 2.5,
    },
  },
  { key: 'ibps-po-pre', label: 'IBPS PO Prelims', template: banking('ibps-po-pre', 60), competitive: true },
  { key: 'sbi-po-pre', label: 'SBI PO Prelims', template: banking('sbi-po-pre', 60), competitive: true },
  { key: 'ibps-clerk-pre', label: 'IBPS Clerk Prelims', template: banking('ibps-clerk-pre', 75), competitive: true },
  {
    key: 'nicl-ao-pre',
    label: 'NICL AO Prelims',
    competitive: true,
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
    competitive: true,
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
    competitive: true,
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

/** Fallback when a project has no test format yet: a plain score out of 100. */
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

