import type { JournalCategory, JournalConfig, JournalField, JournalOption, Mistake, MistakeStatus, MistakeTags, Project } from '../types'

/**
 * Categorical colours, validated with the dataviz palette checker for both
 * themes (lightness band, CVD separation >= 8, normal-vision floor >= 15,
 * 3:1 contrast). Assign in this order; never generate extra hues.
 */
export const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#8b8f99'] as const
export const NEUTRAL = '#8b8f99'

const opts = (labels: [string, string][]): JournalOption[] => labels.map(([key, label], i) => ({ key, label, color: PALETTE[Math.min(i, PALETTE.length - 1)] }))

const BUILTIN_FIELDS = (q = 'What went wrong', r = 'Lesson for next time', s = 'Correct approach', t = 'Time spent vs expected'): JournalField[] => [
  { key: 'question', label: q, type: 'builtin', hidden: false },
  { key: 'rule', label: r, type: 'builtin', hidden: false },
  { key: 'solution', label: s, type: 'builtin', hidden: false },
  { key: 'time', label: t, type: 'builtin', hidden: false },
]

const MISTAKE_TYPES: [string, string][] = [
  ['didnt_know', "Didn't know it"],
  ['careless', 'Careless slip'],
  ['misread', 'Misread the question'],
  ['time', 'Ran out of time'],
  ['stuck', 'Got stuck'],
  ['forgot_step', 'Forgot a step'],
]

const topic = (label = 'Topic', suggestions: [string, string][] = []): JournalCategory => ({ key: 'topic', label, multi: false, required: false, allow_new: true, options: opts(suggestions) })
const mistakeType = (labels: [string, string][] = MISTAKE_TYPES): JournalCategory => ({ key: 'mistake_type', label: 'Mistake type', multi: false, required: true, allow_new: false, options: opts(labels) })
const source = (labels: [string, string][]): JournalCategory => {
  const o = opts(labels)
  const other = o.find((x) => x.key === 'other')
  if (other) other.color = NEUTRAL
  return { key: 'source', label: 'Source', multi: false, required: false, allow_new: false, options: o }
}

/** Mirror of store.DefaultJournalConfig in Go; keep keys in step. */
export const DEFAULT_JOURNAL: JournalConfig = {
  version: 1,
  preset: 'any',
  categories: [
    topic(),
    mistakeType(),
    source([['test', 'Test'], ['homework', 'Homework'], ['practice', 'Practice set'], ['book', 'Book'], ['class', 'Class'], ['other', 'Other']]),
  ],
  fields: BUILTIN_FIELDS(),
  patterns: { threshold: 3, window_days: 14, watch: [['topic', 'mistake_type'], ['mistake_type']] },
  review_weekday: 0,
  tests_enabled: false,
}

export interface JournalPreset {
  key: string
  label: string
  description: string
  config: JournalConfig
}

const preset = (key: string, over: Partial<JournalConfig>): JournalConfig => ({ ...structuredClone(DEFAULT_JOURNAL), ...over, preset: key })

export const JOURNAL_PRESETS: JournalPreset[] = [
  { key: 'any', label: 'General', description: 'Topic, mistake type and source. A good start for anything.', config: structuredClone(DEFAULT_JOURNAL) },
  {
    key: 'school',
    label: 'School',
    description: 'Subjects, topics, homework and tests.',
    config: preset('school', {
      categories: [
        { key: 'subject', label: 'Subject', multi: false, required: true, allow_new: true, options: opts([['maths', 'Maths'], ['science', 'Science'], ['english', 'English'], ['history', 'History'], ['geography', 'Geography'], ['languages', 'Languages']]) },
        topic(),
        mistakeType(),
        source([['test', 'Test'], ['homework', 'Homework'], ['classwork', 'Classwork'], ['textbook', 'Textbook'], ['other', 'Other']]),
      ],
      patterns: { threshold: 3, window_days: 14, watch: [['topic', 'mistake_type'], ['subject', 'mistake_type']] },
    }),
  },
  {
    key: 'university',
    label: 'University',
    description: 'Topics across exams, assignments and problem sets.',
    config: preset('university', {
      categories: [
        topic(),
        mistakeType(),
        source([['exam', 'Exam'], ['assignment', 'Assignment'], ['problem_set', 'Problem set'], ['lecture', 'Lecture'], ['lab', 'Lab'], ['other', 'Other']]),
      ],
    }),
  },
  {
    key: 'certification',
    label: 'Certification',
    description: 'Exam domains and practice exams, with score tracking on.',
    config: preset('certification', {
      categories: [
        { key: 'domain', label: 'Domain', multi: false, required: true, allow_new: true, options: [] },
        topic(),
        mistakeType([['didnt_know', "Didn't know it"], ['careless', 'Careless slip'], ['misread', 'Misread the question'], ['tricky', 'Fell for a distractor'], ['time', 'Ran out of time']]),
        source([['practice_exam', 'Practice exam'], ['question_bank', 'Question bank'], ['course', 'Course'], ['docs', 'Documentation'], ['other', 'Other']]),
      ],
      patterns: { threshold: 3, window_days: 14, watch: [['domain', 'mistake_type'], ['topic']] },
      tests_enabled: true,
    }),
  },
  {
    key: 'language',
    label: 'Language learning',
    description: 'Skills, grammar points and typical slip types.',
    config: preset('language', {
      categories: [
        { key: 'skill', label: 'Skill', multi: false, required: true, allow_new: false, options: opts([['reading', 'Reading'], ['listening', 'Listening'], ['writing', 'Writing'], ['speaking', 'Speaking'], ['grammar', 'Grammar'], ['vocabulary', 'Vocabulary']]) },
        topic('Grammar point or theme'),
        mistakeType([['didnt_know', "Didn't know the rule or word"], ['wrong_form', 'Wrong form or ending'], ['false_friend', 'False friend'], ['careless', 'Careless slip'], ['spelling', 'Spelling'], ['pronunciation', 'Pronunciation']]),
      ],
      fields: BUILTIN_FIELDS('What I said or wrote', 'Correct version', 'Why it is right', 'Time spent vs expected').map((f) => (f.key === 'time' ? { ...f, hidden: true } : f)),
      patterns: { threshold: 3, window_days: 14, watch: [['topic', 'mistake_type'], ['skill']] },
    }),
  },
  {
    key: 'coding',
    label: 'Coding practice',
    description: 'Problem topics and the bugs you keep writing.',
    config: preset('coding', {
      categories: [
        topic('Topic', [['arrays', 'Arrays'], ['strings', 'Strings'], ['graphs', 'Graphs'], ['dp', 'Dynamic programming'], ['trees', 'Trees']]),
        mistakeType([['wrong_approach', 'Wrong approach'], ['edge_case', 'Missed an edge case'], ['off_by_one', 'Off by one'], ['too_slow', 'Too slow'], ['api_slip', 'Syntax or API slip'], ['didnt_know', "Didn't know the concept"]]),
        source([['practice', 'Practice problem'], ['mock_interview', 'Mock interview'], ['contest', 'Contest'], ['project', 'Project'], ['other', 'Other']]),
      ],
      fields: BUILTIN_FIELDS('What went wrong', 'Lesson for next time', 'Correct approach or code', 'Time spent vs expected'),
    }),
  },
  {
    key: 'competitive',
    label: 'Competitive exam',
    description: 'Banking, insurance and SSC style: sections, patterns, ego traps, mock scores.',
    config: preset('competitive', {
      categories: [
        { key: 'subject', label: 'Subject', multi: false, required: true, allow_new: true, options: opts([['quant', 'Quant'], ['reasoning', 'Reasoning'], ['english', 'English'], ['general_awareness', 'General Awareness'], ['professional_knowledge', 'Professional Knowledge']]) },
        topic('Pattern', [['di', 'Data Interpretation'], ['seating', 'Seating Arrangement'], ['puzzles', 'Puzzles'], ['syllogism', 'Syllogism'], ['simplification', 'Simplification'], ['rc', 'Reading Comprehension']]),
        mistakeType([['didnt_know', 'Concept gap'], ['careless', 'Calculation slip'], ['time', 'Time panic / ego trap'], ['misread', 'Misread the question']]),
        source([['mock', 'Mock test'], ['sectional', 'Sectional test'], ['practice', 'Practice'], ['other', 'Other']]),
      ],
      fields: BUILTIN_FIELDS('Question and trap', 'Execution rule', 'Solution notes', 'Actual vs ideal time'),
      patterns: { threshold: 3, window_days: 14, watch: [['topic', 'mistake_type'], ['subject', 'mistake_type']] },
      tests_enabled: true,
    }),
  },
]

export const presetByKey = (key: string) => JOURNAL_PRESETS.find((p) => p.key === key)

/** The project's setup, else the user's default, else the built-in one. */
export function effectiveConfig(project: Project | null | undefined, userDefault: JournalConfig | null | undefined): JournalConfig {
  return project?.journal_config ?? userDefault ?? DEFAULT_JOURNAL
}

export const categoryOf = (cfg: JournalConfig, key: string) => cfg.categories.find((c) => c.key === key)
export const fieldOf = (cfg: JournalConfig, key: string) => cfg.fields.find((f) => f.key === key)
export const fieldVisible = (cfg: JournalConfig, key: string) => {
  const f = fieldOf(cfg, key)
  return f ? !f.hidden : false
}
export const fieldLabel = (cfg: JournalConfig, key: string, fallback: string) => fieldOf(cfg, key)?.label ?? fallback

/** Values of a category on a mistake, always as a list. */
export function tagValues(m: Pick<Mistake, 'tags'>, key: string): string[] {
  const v = m.tags[key]
  if (Array.isArray(v)) return v
  return v ? [v] : []
}

export function optionLabel(cat: JournalCategory | undefined, value: string): string {
  return cat?.options.find((o) => o.key === value)?.label ?? value
}

/** Option colour; free-text values take a neutral colour. */
export function optionColor(cat: JournalCategory | undefined, value: string): string {
  return cat?.options.find((o) => o.key === value)?.color || NEUTRAL
}

/** Human summary of a mistake's tags in setup order, e.g. "Fractions · Careless slip". */
export function describeTags(cfg: JournalConfig, m: Pick<Mistake, 'tags'>): string {
  return cfg.categories
    .flatMap((c) => tagValues(m, c.key).map((v) => optionLabel(c, v)))
    .join(' · ')
}

/** Turns typed text into an option key when it names an option, else keeps the text. */
export function normalizeValue(cat: JournalCategory, typed: string): string {
  const t = typed.trim()
  const hit = cat.options.find((o) => o.key === t || o.label.toLowerCase() === t.toLowerCase())
  return hit ? hit.key : t
}

/** A lowercase key for a new category, option or field, unique among `taken`. */
export function makeKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'item'
  let key = base
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`.slice(0, 30)
  return key
}

/** Next unused palette colour for a new option. */
export function nextColor(options: JournalOption[]): string {
  const used = new Set(options.map((o) => o.color))
  return PALETTE.find((c) => !used.has(c)) ?? NEUTRAL
}

/** Missing required categories for the given tags. */
export function missingRequired(cfg: JournalConfig, tags: MistakeTags): JournalCategory[] {
  return cfg.categories.filter((c) => c.required && tagValues({ tags }, c.key).length === 0)
}

/** Values in use for a category across mistakes, most used first. */
export function valuesInUse(mistakes: Mistake[], key: string): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const m of mistakes) for (const v of tagValues(m, key)) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/** Reads a shared setup file; returns null when it is not a usable setup. */
export function parseSetupFile(text: string): JournalConfig | null {
  try {
    const v = JSON.parse(text) as Partial<JournalConfig>
    if (!v || !Array.isArray(v.categories) || !Array.isArray(v.fields) || !v.patterns) return null
    return { ...structuredClone(DEFAULT_JOURNAL), ...v, version: 1 } as JournalConfig
  } catch {
    return null
  }
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A flashcard drafted from a mistake. */
export function cardFromMistake(cfg: JournalConfig, m: Mistake, projectId: number) {
  const tagLine = describeTags(cfg, m)
  const front = (m.question.trim() || tagLine || 'Mistake').slice(0, 2000)
  const back = [m.rule.trim(), m.solution.trim()].filter(Boolean).join('\n\n') || 'Write the lesson here.'
  const topicValue = tagValues(m, 'topic')[0]
  const tag = topicValue ? makeKey(optionLabel(categoryOf(cfg, 'topic'), topicValue), []).replace(/_/g, '-').slice(0, 30) : ''
  return { project_id: projectId, front, back: back.slice(0, 4000), tags: tag ? [tag, 'mistake'] : ['mistake'] }
}

export const STATUS_LABELS: Record<MistakeStatus, string> = {
  active: 'New',
  locked_in: 'Locked in',
  review_next_week: 'Review next week',
  needs_drill: 'Needs practice',
}

/** Symbols for the lesson box (typed at the cursor). */
export const RULE_SYMBOLS = ['×', '÷', '±', '√', '²', '³', '≈', '≠', '≤', '≥', '→', '%', 'π', '∴', '∵', 'Δ']

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV with the setup's categories and fields as columns. */
export function mistakesToCsv(cfg: JournalConfig, mistakes: Mistake[], projectName: (id: number) => string, testName: (id: number | null) => string): string {
  const custom = cfg.fields.filter((f) => f.type !== 'builtin')
  const head = ['Date', 'Project', 'Test', ...cfg.categories.map((c) => c.label), fieldLabel(cfg, 'question', 'What went wrong'), fieldLabel(cfg, 'rule', 'Lesson for next time'), fieldLabel(cfg, 'solution', 'Correct approach'), ...custom.map((f) => f.label), 'Actual seconds', 'Expected seconds', 'Status']
  const rows = mistakes.map((m) => [
    m.created_at.slice(0, 10), projectName(m.project_id), testName(m.mock_id),
    ...cfg.categories.map((c) => tagValues(m, c.key).map((v) => optionLabel(c, v)).join(', ')),
    m.question, m.rule, m.solution, ...custom.map((f) => m.extra[f.key] ?? ''), m.actual_seconds, m.ideal_seconds, m.status,
  ])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
