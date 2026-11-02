import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bold, Crosshair } from 'lucide-react'
import type { JournalConfig, Mistake, MistakeExtra, MistakeInput, MistakeTags, Mock } from '../../types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, inputClass } from '../ui/Field'
import { CategoryInput } from './CategoryInput'
import { RULE_SYMBOLS, fieldLabel, fieldVisible, missingRequired, valuesInUse } from '../../lib/journal'
import { clearDraft, readDraft, useDraftAutosave } from '../../hooks/useDraft'

interface Props {
  isOpen: boolean
  projectId: number
  config: JournalConfig
  tests: Mock[]
  recent: Mistake[]
  editing: Mistake | null
  defaultTestId: number | null
  draftKey: string
  onClose: () => void
  onSave: (input: MistakeInput) => Promise<Mistake>
}

interface FormState {
  mock_id: number | null
  tags: MistakeTags
  extra: MistakeExtra
  question: string
  rule: string
  solution: string
  actual: string
  ideal: string
}

const isFormState = (v: unknown): v is FormState =>
  typeof v === 'object' && v !== null && typeof (v as FormState).tags === 'object' && typeof (v as FormState).rule === 'string'

const blank = (mockId: number | null, keep: MistakeTags = {}): FormState => ({ mock_id: mockId, tags: keep, extra: {}, question: '', rule: '', solution: '', actual: '', ideal: '' })

const fromMistake = (m: Mistake): FormState => ({
  mock_id: m.mock_id,
  tags: { ...m.tags },
  extra: { ...m.extra },
  question: m.question,
  rule: m.rule,
  solution: m.solution,
  actual: m.actual_seconds === null ? '' : String(m.actual_seconds),
  ideal: m.ideal_seconds === null ? '' : String(m.ideal_seconds),
})

const secs = (v: string) => (v.trim() === '' ? null : Math.min(3600, Math.max(0, Math.round(Number(v)) || 0)))

/**
 * Mistake entry generated from the user's setup. Tab moves between groups,
 * arrows pick, Ctrl/Cmd+Enter saves and clears the form for the next one
 * (keeping the first category, e.g. the subject, and the linked test).
 */
export const MistakeForm: React.FC<Props> = ({ isOpen, projectId, config, tests, recent, editing, defaultTestId, draftKey, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(() => blank(defaultTestId))
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const ruleRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const openKey = isOpen ? `${projectId}:${editing?.id ?? 'new'}` : null
  if (openKey !== openedFor) {
    setOpenedFor(openKey)
    if (openKey) {
      const draft = editing ? null : readDraft(draftKey, isFormState)
      setForm(editing ? fromMistake(editing) : draft ?? blank(defaultTestId))
      setRestored(Boolean(draft && (draft.question || draft.rule || Object.keys(draft.tags).length)))
      setError(null)
      setCount(0)
      setGeneration((g) => g + 1)
    }
  }
  useDraftAutosave(draftKey, form, isOpen && !editing)

  const used = useMemo(() => Object.fromEntries(config.categories.map((c) => [c.key, valuesInUse(recent, c.key).map((v) => v.value)])), [config, recent])
  const custom = config.fields.filter((f) => f.type !== 'builtin' && !f.hidden)

  // Caret to restore once React has committed an inserted symbol. Applied in a
  // layout effect (before the next key event), not a later animation frame,
  // so fast typing after a click never lands in the wrong place.
  const pendingCaret = useRef<[number, number] | null>(null)
  useLayoutEffect(() => {
    const el = ruleRef.current
    if (!el || !pendingCaret.current) return
    el.setSelectionRange(...pendingCaret.current)
    pendingCaret.current = null
  }, [form.rule])

  const insertAtCursor = (before: string, after = '') => {
    const el = ruleRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e)
    const end = s + before.length + (e - s)
    pendingCaret.current = [after ? s + before.length : end, end]
    el.focus()
    setForm((f) => ({ ...f, rule: next.slice(0, 2000) }))
  }

  const save = async (another: boolean) => {
    const missing = missingRequired(config, form.tags)
    if (missing.length) {
      setError(`Pick ${missing.map((c) => c.label.toLowerCase()).join(' and ')}.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const tags: MistakeTags = {}
      for (const c of config.categories) {
        const v = form.tags[c.key]
        if (Array.isArray(v) ? v.length : v) tags[c.key] = v as string | string[]
      }
      // Keep tags from categories no longer in the setup.
      for (const [k, v] of Object.entries(form.tags)) if (!(k in tags) && !config.categories.some((c) => c.key === k) && v) tags[k] = v
      await onSave({
        project_id: projectId,
        mock_id: form.mock_id,
        tags,
        extra: form.extra,
        question: form.question,
        rule: form.rule,
        solution: form.solution,
        actual_seconds: secs(form.actual),
        ideal_seconds: secs(form.ideal),
      })
      if (!editing) clearDraft(draftKey)
      if (another && !editing) {
        const first = config.categories[0]
        setForm(blank(form.mock_id, first && form.tags[first.key] ? { [first.key]: form.tags[first.key] } : {}))
        setRestored(false)
        setCount((n) => n + 1)
        setGeneration((g) => g + 1)
        requestAnimationFrame(() => {
          const f = formRef.current
          ;(f?.querySelector<HTMLInputElement>('input:checked') ?? f?.querySelector<HTMLInputElement>('input'))?.focus()
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

  const over = secs(form.actual) !== null && secs(form.ideal) !== null ? (secs(form.actual) ?? 0) - (secs(form.ideal) ?? 0) : 0

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
            <button type="button" onClick={() => { clearDraft(draftKey); setForm(blank(defaultTestId)); setRestored(false); setGeneration((g) => g + 1) }} className="focus-ring rounded font-semibold text-brand-300 underline-offset-2 hover:underline">Start fresh</button>
          </p>
        )}
        {count > 0 && <p className="text-xs text-brand-300" role="status">{count} logged this sitting. Next one.</p>}

        {config.categories.map((c) => (
          <CategoryInput
            key={`${c.key}:${generation}`}
            cat={c}
            value={form.tags[c.key]}
            used={used[c.key] ?? []}
            onChange={(v) => setForm((f) => {
              const tags = { ...f.tags }
              if (v === undefined || (Array.isArray(v) && v.length === 0)) delete tags[c.key]
              else tags[c.key] = v
              return { ...f, tags }
            })}
          />
        ))}

        {fieldVisible(config, 'question') && (
          <Field label={fieldLabel(config, 'question', 'What went wrong')}>
            {(id) => <textarea id={id} className={`${inputClass} min-h-[64px]`} maxLength={2000} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />}
          </Field>
        )}

        {(fieldVisible(config, 'time') || (config.tests_enabled && tests.length > 0)) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_2fr]">
            {fieldVisible(config, 'time') && (
              <>
                <Field label="Time spent (sec)">
                  {(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" min={0} max={3600} value={form.actual} onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))} />}
                </Field>
                <Field label="Expected (sec)">
                  {(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" min={0} max={3600} value={form.ideal} onChange={(e) => setForm((f) => ({ ...f, ideal: e.target.value }))} />}
                </Field>
              </>
            )}
            {config.tests_enabled && tests.length > 0 && (
              <Field label="From test" className="col-span-2 sm:col-span-1">
                {(id) => (
                  <select id={id} className={inputClass} value={form.mock_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, mock_id: e.target.value ? Number(e.target.value) : null }))}>
                    <option value="">Not from a test</option>
                    {tests.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.attempted_on}</option>)}
                  </select>
                )}
              </Field>
            )}
          </div>
        )}
        {over > 0 && <p className="-mt-2 text-[11px] text-amber-200">{over} seconds over the expected time.</p>}

        {fieldVisible(config, 'rule') && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="mistake-rule" className="text-xs font-medium text-ink-300">{fieldLabel(config, 'rule', 'Lesson for next time')}</label>
              {/* mousedown is cancelled so the textarea keeps focus and its selection while clicking. */}
              <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Insert formatting" onMouseDown={(e) => e.preventDefault()}>
                <button type="button" tabIndex={-1} aria-label="Bold" onClick={() => insertAtCursor('**', '**')} className="focus-ring rounded-md p-1 text-ink-400 hover:bg-fg/[0.06] hover:text-ink-50"><Bold className="h-3.5 w-3.5" aria-hidden="true" /></button>
                {RULE_SYMBOLS.map((sym) => (
                  <button key={sym} type="button" tabIndex={-1} aria-label={`Insert ${sym}`} onClick={() => insertAtCursor(sym)} className="focus-ring min-w-[1.5rem] rounded-md px-1 py-0.5 font-mono text-xs text-ink-400 hover:bg-fg/[0.06] hover:text-ink-50">{sym}</button>
                ))}
              </div>
            </div>
            <textarea id="mistake-rule" ref={ruleRef} className={`${inputClass} min-h-[64px]`} maxLength={2000} placeholder="What will you do differently next time?" value={form.rule} onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))} />
          </div>
        )}

        {fieldVisible(config, 'solution') && (
          <Field label={fieldLabel(config, 'solution', 'Correct approach')}>
            {(id) => <textarea id={id} className={`${inputClass} min-h-[48px]`} maxLength={4000} value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} />}
          </Field>
        )}

        {custom.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {custom.map((fd) => {
              const v = form.extra[fd.key]
              const set = (val: string | number | boolean | undefined) => setForm((f) => {
                const extra = { ...f.extra }
                if (val === undefined || val === '') delete extra[fd.key]
                else extra[fd.key] = val
                return { ...f, extra }
              })
              if (fd.type === 'yesno') {
                return (
                  <label key={fd.key} className="flex items-center gap-2 self-end text-sm text-ink-200">
                    <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={v === true} onChange={(e) => set(e.target.checked ? true : undefined)} />
                    {fd.label}
                  </label>
                )
              }
              return (
                <Field key={fd.key} label={fd.label}>
                  {(id) =>
                    fd.type === 'select' ? (
                      <select id={id} className={inputClass} value={typeof v === 'string' ? v : ''} onChange={(e) => set(e.target.value || undefined)}>
                        <option value="">—</option>
                        {(fd.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : fd.type === 'number' ? (
                      <input id={id} className={inputClass} type="number" value={typeof v === 'number' ? v : ''} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />
                    ) : (
                      <input id={id} className={inputClass} maxLength={500} value={typeof v === 'string' ? v : ''} onChange={(e) => set(e.target.value)} />
                    )
                  }
                </Field>
              )
            })}
          </div>
        )}

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
