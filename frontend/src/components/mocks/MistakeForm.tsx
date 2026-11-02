import React, { useMemo, useRef, useState } from 'react'
import { Bold, Crosshair } from 'lucide-react'
import type { ExamTemplate, Mistake, MistakeInput, Mock, RootCause } from '../../types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, inputClass } from '../ui/Field'
import { PillGroup } from './PillGroup'
import { PATTERNS, ROOT_CAUSES, RULE_SYMBOLS, SUBJECTS } from '../../lib/examTemplates'
import { clearDraft, readDraft, useDraftAutosave } from '../../hooks/useDraft'

interface Props {
  isOpen: boolean
  projectId: number
  template: ExamTemplate | null | undefined
  mocks: Mock[]
  recent: Mistake[]
  editing: Mistake | null
  defaultMockId: number | null
  draftKey: string
  onClose: () => void
  onSave: (input: MistakeInput) => Promise<Mistake>
}

interface FormState {
  mock_id: number | null
  subject: string
  pattern: string
  root_cause: RootCause | ''
  question: string
  rule: string
  solution: string
  actual: string
  ideal: string
}

const isFormState = (v: unknown): v is FormState =>
  typeof v === 'object' && v !== null && typeof (v as FormState).subject === 'string' && typeof (v as FormState).rule === 'string'

const blank = (mockId: number | null, subject = ''): FormState => ({ mock_id: mockId, subject, pattern: '', root_cause: '', question: '', rule: '', solution: '', actual: '', ideal: '' })

const fromMistake = (m: Mistake): FormState => ({
  mock_id: m.mock_id,
  subject: m.subject,
  pattern: m.pattern,
  root_cause: m.root_cause,
  question: m.question,
  rule: m.rule,
  solution: m.solution,
  actual: m.actual_seconds === null ? '' : String(m.actual_seconds),
  ideal: m.ideal_seconds === null ? '' : String(m.ideal_seconds),
})

const secs = (v: string) => (v.trim() === '' ? null : Math.min(3600, Math.max(0, Math.round(Number(v)) || 0)))

const CAUSE_TONE: Record<RootCause, string> = {
  concept: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  procedural: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
  time_ego: 'border-rose-400/40 bg-rose-400/15 text-rose-200',
}

/**
 * The 20-second error entry: pills for subject, pattern and root cause, then
 * free text. Ctrl/Cmd+Enter saves and clears the form for the next mistake.
 */
export const MistakeForm: React.FC<Props> = ({ isOpen, projectId, template, mocks, recent, editing, defaultMockId, draftKey, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(() => blank(defaultMockId))
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  const ruleRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const openKey = isOpen ? `${projectId}:${editing?.id ?? 'new'}` : null
  if (openKey !== openedFor) {
    setOpenedFor(openKey)
    if (openKey) {
      const draft = editing ? null : readDraft(draftKey, isFormState)
      setForm(editing ? fromMistake(editing) : draft ?? blank(defaultMockId))
      setRestored(Boolean(draft && (draft.question || draft.rule || draft.pattern)))
      setError(null)
      setCount(0)
    }
  }
  useDraftAutosave(draftKey, form, isOpen && !editing)

  const subjects = useMemo(() => {
    const fromTemplate = (template?.sections ?? []).map((s) => s.name)
    const used = recent.map((m) => m.subject)
    return [...new Set([...SUBJECTS, ...fromTemplate, ...used])].slice(0, 10)
  }, [template, recent])

  const patterns = useMemo(() => {
    const used = recent.filter((m) => m.subject === form.subject).map((m) => m.pattern)
    const presets = PATTERNS[form.subject] ?? []
    return [...new Set([...used.slice(0, 6), ...presets])].slice(0, 14)
  }, [recent, form.subject])
  const allPatterns = useMemo(() => [...new Set([...recent.map((m) => m.pattern), ...Object.values(PATTERNS).flat()])], [recent])

  const insertAtCursor = (before: string, after = '') => {
    const el = ruleRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e)
    setForm((f) => ({ ...f, rule: next.slice(0, 2000) }))
    requestAnimationFrame(() => {
      el.focus()
      const pos = s + before.length + (e - s)
      el.setSelectionRange(after ? s + before.length : pos, after ? pos : pos)
    })
  }

  const save = async (another: boolean) => {
    if (!form.subject.trim() || !form.pattern.trim() || !form.root_cause) {
      setError('Pick a subject, a pattern and a root cause.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        project_id: projectId,
        mock_id: form.mock_id,
        subject: form.subject.trim(),
        pattern: form.pattern.trim(),
        root_cause: form.root_cause,
        question: form.question,
        rule: form.rule,
        solution: form.solution,
        actual_seconds: secs(form.actual),
        ideal_seconds: secs(form.ideal),
      })
      if (!editing) clearDraft(draftKey)
      if (another && !editing) {
        setForm(blank(form.mock_id, form.subject))
        setRestored(false)
        setCount((n) => n + 1)
        requestAnimationFrame(() => {
          const f = formRef.current
          ;(f?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ?? f?.querySelector<HTMLInputElement>('input[type="radio"]'))?.focus()
        })
      } else {
        onClose()
      }
    } catch {
      /* toast shown by caller */
    } finally {
      setSaving(false)
    }
  }

  const projectMocks = mocks.filter((m) => m.project_id === projectId)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={editing ? 'Edit mistake' : 'Log a mistake'} description={editing ? undefined : 'Tab between groups, arrows to pick. Ctrl+Enter saves and starts the next one.'} icon={<Crosshair className="h-5 w-5" aria-hidden="true" />}>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          void save(!editing)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void save(!editing)
          }
        }}
        className="space-y-4"
      >
        {restored && (
          <p className="flex items-center justify-between gap-2 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3 py-2 text-xs text-ink-200" role="status">
            Restored your unsaved draft.
            <button type="button" onClick={() => { clearDraft(draftKey); setForm(blank(defaultMockId)); setRestored(false) }} className="focus-ring rounded font-semibold text-brand-300 underline-offset-2 hover:underline">Start fresh</button>
          </p>
        )}
        {count > 0 && <p className="text-xs text-brand-300" role="status">{count} logged this sitting. Next one.</p>}

        <PillGroup label="Subject" options={subjects.map((s) => ({ value: s, label: s }))} value={form.subject} onChange={(subject) => setForm((f) => ({ ...f, subject, pattern: f.subject === subject ? f.pattern : '' }))} />

        <div>
          {form.subject && patterns.length > 0 && (
            <PillGroup label="Pattern" options={patterns.map((p) => ({ value: p, label: p }))} value={patterns.includes(form.pattern) ? form.pattern : ''} onChange={(pattern) => setForm((f) => ({ ...f, pattern }))} />
          )}
          <input
            aria-label={patterns.length ? 'Or type a pattern' : 'Pattern'}
            list="mistake-patterns"
            className={`${inputClass} mt-2`}
            maxLength={80}
            placeholder={patterns.length ? 'Or type a pattern' : 'Pattern, e.g. Seating: Circular'}
            value={form.pattern}
            onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
          />
          <datalist id="mistake-patterns">
            {allPatterns.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>

        <PillGroup label="Root cause" options={ROOT_CAUSES.map((c) => ({ value: c.value, label: c.label, title: c.help }))} value={form.root_cause} onChange={(root_cause) => setForm((f) => ({ ...f, root_cause }))} tone={(v) => CAUSE_TONE[v]} />

        <Field label="Question and trap" hint="What was asked and what tricked you">
          {(id, d) => <textarea id={id} aria-describedby={d} className={`${inputClass} min-h-[64px]`} maxLength={2000} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />}
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_2fr]">
          <Field label="Actual time (sec)">
            {(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" min={0} max={3600} value={form.actual} onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))} />}
          </Field>
          <Field label="Ideal time (sec)">
            {(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" min={0} max={3600} value={form.ideal} onChange={(e) => setForm((f) => ({ ...f, ideal: e.target.value }))} />}
          </Field>
          <Field label="Mock" className="col-span-2 sm:col-span-1">
            {(id) => (
              <select id={id} className={inputClass} value={form.mock_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, mock_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Not from a mock</option>
                {projectMocks.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.attempted_on}</option>)}
              </select>
            )}
          </Field>
        </div>
        {secs(form.actual) !== null && secs(form.ideal) !== null && (secs(form.actual) ?? 0) > (secs(form.ideal) ?? 0) && (
          <p className="-mt-2 text-[11px] text-amber-200">{(secs(form.actual) ?? 0) - (secs(form.ideal) ?? 0)} seconds over the ideal time.</p>
        )}

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="mistake-rule" className="text-xs font-medium text-ink-300">Execution rule</label>
            {/* mousedown is cancelled so the textarea keeps focus and its selection while clicking. */}
            <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Insert formatting" onMouseDown={(e) => e.preventDefault()}>
              <button type="button" tabIndex={-1} aria-label="Bold" onClick={() => insertAtCursor('**', '**')} className="focus-ring rounded-md p-1 text-ink-400 hover:bg-fg/[0.06] hover:text-ink-50"><Bold className="h-3.5 w-3.5" aria-hidden="true" /></button>
              {RULE_SYMBOLS.map((sym) => (
                <button key={sym} type="button" tabIndex={-1} aria-label={`Insert ${sym}`} onClick={() => insertAtCursor(sym)} className="focus-ring min-w-[1.5rem] rounded-md px-1 py-0.5 font-mono text-xs text-ink-400 hover:bg-fg/[0.06] hover:text-ink-50">{sym}</button>
              ))}
            </div>
          </div>
          <textarea id="mistake-rule" ref={ruleRef} className={`${inputClass} min-h-[64px]`} maxLength={2000} placeholder="e.g. Always write **N** or **S** above linear seating anchors before tracing turns" value={form.rule} onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))} />
        </div>

        <Field label="Solution notes">
          {(id) => <textarea id={id} className={`${inputClass} min-h-[48px]`} maxLength={4000} value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} />}
        </Field>

        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{count > 0 ? 'Done' : 'Cancel'}</Button>
          {!editing && <Button variant="secondary" loading={saving} onClick={() => void save(false)}>Save and close</Button>}
          <Button type="submit" loading={saving}>{editing ? 'Save mistake' : 'Save and next'}</Button>
        </div>
      </form>
    </Modal>
  )
}
