import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE, EXAM_PRESETS, sectionsFromTemplate } from './examTemplates'

describe('exam presets', () => {
  it('have unique keys and sane sections', () => {
    expect(new Set(EXAM_PRESETS.map((p) => p.key)).size).toBe(EXAM_PRESETS.length)
    for (const p of EXAM_PRESETS) {
      expect(p.template.key).toBe(p.key)
      expect(p.template.sections.length).toBeGreaterThan(0)
      expect(p.template.sections.length).toBeLessThanOrEqual(8)
    }
  })
  it('banking prelims add up to 100 marks in 60 minutes', () => {
    const t = EXAM_PRESETS.find((p) => p.key === 'ibps-po-pre')!.template
    expect(t.sections.reduce((a, s) => a + s.questions * s.marks_each, 0)).toBe(100)
    expect(t.sections.reduce((a, s) => a + s.minutes, 0)).toBe(60)
  })
  it('defaults to a plain score without negative marking', () => {
    expect(DEFAULT_TEMPLATE).toMatchObject({ key: 'simple', negative_fraction: 0 })
    expect(EXAM_PRESETS.filter((p) => !p.competitive).length).toBeGreaterThanOrEqual(4)
  })
  it('derives the per-question penalty from the negative fraction', () => {
    const ssc = EXAM_PRESETS.find((p) => p.key === 'ssc-cgl-t1')!.template
    const s = sectionsFromTemplate(ssc)
    expect(s[0]).toMatchObject({ marks_each: 2, negative_each: 0.5, seconds: 900, correct: 0, incorrect: 0 })
  })
})
