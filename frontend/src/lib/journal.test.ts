import { describe, expect, it } from 'vitest'
import type { Mistake, Project } from '../types'
import { DEFAULT_JOURNAL, JOURNAL_PRESETS, cardFromMistake, mistakesToCsv, describeTags, effectiveConfig, makeKey, missingRequired, nextColor, normalizeValue, parseSetupFile, tagValues, valuesInUse } from './journal'

const m = (tags: Mistake['tags'], over: Partial<Mistake> = {}): Mistake => ({
  id: 1, project_id: 1, mock_id: null, tags, extra: {}, question: '', rule: '', solution: '', actual_seconds: null, ideal_seconds: null,
  status: 'active', last_reviewed_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
})

describe('journal setup', () => {
  it('default mirrors the Go keys and presets are well formed', () => {
    expect(DEFAULT_JOURNAL.categories.map((c) => c.key)).toEqual(['topic', 'mistake_type', 'source'])
    expect(DEFAULT_JOURNAL.categories[1].options.map((o) => o.key)).toEqual(['didnt_know', 'careless', 'misread', 'time', 'stuck', 'forgot_step'])
    for (const p of JOURNAL_PRESETS) {
      const keys = p.config.categories.map((c) => c.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const combo of p.config.patterns.watch) for (const k of combo) expect(keys).toContain(k)
      for (const c of p.config.categories) {
        expect(new Set(c.options.map((o) => o.key)).size).toBe(c.options.length)
        for (const o of c.options) expect(o.key).toMatch(/^[a-z0-9_]{1,30}$/)
        if (!c.allow_new) expect(c.options.length).toBeGreaterThan(0)
      }
    }
  })
  it('resolves project, then user default, then built-in', () => {
    const own = { ...DEFAULT_JOURNAL, preset: 'own' }
    const user = { ...DEFAULT_JOURNAL, preset: 'user' }
    expect(effectiveConfig({ journal_config: own } as Project, user).preset).toBe('own')
    expect(effectiveConfig({} as Project, user).preset).toBe('user')
    expect(effectiveConfig(null, null).preset).toBe('any')
  })
  it('describes, normalises and validates tags', () => {
    expect(describeTags(DEFAULT_JOURNAL, m({ topic: 'Fractions', mistake_type: 'careless' }))).toBe('Fractions · Careless slip')
    expect(normalizeValue(DEFAULT_JOURNAL.categories[1], 'careless SLIP')).toBe('careless')
    expect(normalizeValue(DEFAULT_JOURNAL.categories[0], ' Fractions ')).toBe('Fractions')
    expect(tagValues(m({ chapter: ['a', 'b'] }), 'chapter')).toEqual(['a', 'b'])
    expect(missingRequired(DEFAULT_JOURNAL, { topic: 'x' }).map((c) => c.key)).toEqual(['mistake_type'])
    expect(valuesInUse([m({ topic: 'A' }), m({ topic: 'B' }), m({ topic: 'A' })], 'topic')).toEqual([{ value: 'A', count: 2 }, { value: 'B', count: 1 }])
  })
  it('makes unique keys and picks unused colours', () => {
    expect(makeKey("Didn't know it!", [])).toBe('didn_t_know_it')
    expect(makeKey('Topic', ['topic', 'topic_2'])).toBe('topic_3')
    expect(makeKey('???', [])).toBe('item')
    expect(nextColor(DEFAULT_JOURNAL.categories[1].options)).toBe('#e66767')
  })
  it('parses a shared setup and rejects junk', () => {
    expect(parseSetupFile(JSON.stringify(JOURNAL_PRESETS.find((p) => p.key === 'language')!.config))?.preset).toBe('language')
    expect(parseSetupFile('{"categories": 1}')).toBeNull()
    expect(parseSetupFile('not json')).toBeNull()
  })
  it('drafts a flashcard from a mistake', () => {
    const c = cardFromMistake(DEFAULT_JOURNAL, m({ topic: 'Long Division', mistake_type: 'careless' }, { question: '84 ÷ 4', rule: 'Check the **remainder**', solution: '21' }), 7)
    expect(c).toEqual({ project_id: 7, front: '84 ÷ 4', back: 'Check the **remainder**\n\n21', tags: ['long-division', 'mistake'] })
  })
  it('exports CSV with setup columns and neutralised formulas', () => {
    const csv = mistakesToCsv(DEFAULT_JOURNAL, [m({ topic: 'Fractions', mistake_type: 'careless' }, { question: '=SUM(A1)', rule: 'a, "b"' })], () => 'P', () => '')
    const [head, line] = csv.split('\r\n')
    expect(head).toBe('Date,Project,Test,Topic,Mistake type,Source,What went wrong,Lesson for next time,Correct approach,Actual seconds,Expected seconds,Status')
    expect(line).toContain('Fractions,Careless slip,')
    expect(line).toContain("'=SUM(A1)")
    expect(line).toContain('"a, ""b"""')
  })
})
