import React, { useState } from 'react'
import { AlertTriangle, ClipboardCheck } from 'lucide-react'
import type { ExamTemplate, Mock, MockInput, MockSection } from '../../types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, inputClass } from '../ui/Field'
import { scoreMock } from '../../lib/scoring'
import { DEFAULT_TEMPLATE, sectionsFromTemplate } from '../../lib/examTemplates'
import { localDateString } from '../../lib/time'
import { clearDraft, readDraft, useDraftAutosave } from '../../hooks/useDraft'

interface Props {
  isOpen: boolean
  projectId: number
  template: ExamTemplate | null | undefined
  editing: Mock | null
  draftKey: string
  onClose: () => void
  onSave: (input: MockInput) => Promise<Mock>
}

interface FormState {
  name: string
  provider: string
  attempted_on: string
  percentile: string
  rank: string
  notes: string
  sections: MockSection[]
}

const isFormState = (v: unknown): v is FormState =>
  typeof v === 'object' && v !== null && typeof (v as FormState).name === 'string' && Array.isArray((v as FormState).sections)

const blank = (t: ExamTemplate | null | undefined): FormState => ({
  name: '',
  provider: '',
  attempted_on: localDateString(),
  percentile: '',
  rank: '',
  notes: '',
  sections: sectionsFromTemplate(t ?? DEFAULT_TEMPLATE),
})

const fromMock = (m: Mock): FormState => ({
  name: m.name,
  provider: m.provider,
  attempted_on: m.attempted_on,
  percentile: m.percentile === null ? '' : String(m.percentile),
  rank: m.rank === null ? '' : String(m.rank),
  notes: m.notes,
  sections: m.sections.map((s) => ({ ...s })),
})

const int = (v: string) => (v.trim() === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0))

/** Log or edit a mock. New-mock input is auto-saved as a draft. */
export const MockForm: React.FC<Props> = ({ isOpen, projectId, template, editing, draftKey, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(() => blank(template))
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<string | null>(null)

  // Reset when (re)opened for a different mock or project.
  const openKey = isOpen ? `${projectId}:${editing?.id ?? 'new'}` : null
  if (openKey !== openedFor) {
    setOpenedFor(openKey)
    if (openKey) {
      const draft = editing ? null : readDraft(draftKey, isFormState)
      setForm(editing ? fromMock(editing) : draft ?? blank(template))
      setRestored(Boolean(draft))
      setError(null)
    }
  }
  useDraftAutosave(draftKey, form, isOpen && !editing)

  const score = scoreMock(form, template)
  const setSection = (i: number, patch: Partial<MockSection>) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const over = form.sections.find((s) => s.correct + s.incorrect > s.questions)
    if (over) {
      setError(`${over.name}: correct plus incorrect is more than ${over.questions} questions.`)
      return
    }
    if (!form.name.trim()) {
      setError('Give the mock a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        project_id: projectId,
        name: form.name.trim(),
        provider: form.provider.trim(),
        attempted_on: form.attempted_on,
        percentile: form.percentile.trim() === '' ? null : Number(form.percentile),
        rank: form.rank.trim() === '' ? null : int(form.rank),
        notes: form.notes,
        sections: form.sections,
      })
      if (!editing) clearDraft(draftKey)
      onClose()
    } catch {
      /* toast shown by caller; keep the form */
    } finally {
      setSaving(false)
    }
  }

  const discardDraft = () => {
    clearDraft(draftKey)
    setForm(blank(template))
    setRestored(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={editing ? 'Edit mock' : 'Log a mock test'} icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}>
      <form onSubmit={submit} className="space-y-5">
        {restored && (
          <p className="flex items-center justify-between gap-2 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3 py-2 text-xs text-ink-200" role="status">
            Restored your unsaved draft.
            <button type="button" onClick={discardDraft} className="focus-ring rounded font-semibold text-brand-300 underline-offset-2 hover:underline">Start fresh</button>
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mock name">
            {(id) => <input id={id} className={inputClass} value={form.name} maxLength={120} required placeholder="e.g. Full mock 12" onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="Test series provider">
            {(id) => <input id={id} className={inputClass} value={form.provider} maxLength={80} placeholder="Optional" onChange={(e) => setForm({ ...form, provider: e.target.value })} />}
          </Field>
          <Field label="Date attempted">
            {(id) => <input id={id} className={inputClass} type="date" value={form.attempted_on} max={localDateString()} required onChange={(e) => setForm({ ...form, attempted_on: e.target.value })} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Percentile">
              {(id) => <input id={id} className={inputClass} type="number" min={0} max={100} step={0.01} value={form.percentile} placeholder="—" onChange={(e) => setForm({ ...form, percentile: e.target.value })} />}
            </Field>
            <Field label="Rank">
              {(id) => <input id={id} className={inputClass} type="number" min={1} value={form.rank} placeholder="—" onChange={(e) => setForm({ ...form, rank: e.target.value })} />}
            </Field>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-300">Sections</legend>
          <div className="space-y-2">
            {form.sections.map((s, i) => {
              const sc = score.sections[i]
              const flagged = sc.lowAccuracy || sc.highPenalty
              return (
                <div key={i} className={`rounded-2xl border p-3 ${flagged ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'border-fg/[0.06] bg-fg/[0.02]'}`}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink-100">{s.name} <span className="text-xs font-normal text-ink-500">· {s.questions} Q</span></span>
                    <span className="font-mono text-xs tabular-nums text-ink-300" data-testid={`section-score-${i}`}>
                      {sc.net} / {sc.maxMarks} · {sc.accuracy}% acc · {sc.attemptRate}% att
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[11px] text-ink-500">
                      Correct
                      <input aria-label={`${s.name} correct`} className={`${inputClass} mt-1`} type="number" inputMode="numeric" min={0} max={s.questions} value={s.correct || ''} placeholder="0" onChange={(e) => setSection(i, { correct: int(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Incorrect
                      <input aria-label={`${s.name} incorrect`} className={`${inputClass} mt-1`} type="number" inputMode="numeric" min={0} max={s.questions} value={s.incorrect || ''} placeholder="0" onChange={(e) => setSection(i, { incorrect: int(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Minutes spent
                      <input aria-label={`${s.name} minutes`} className={`${inputClass} mt-1`} type="number" inputMode="numeric" min={0} max={600} value={Math.round(s.seconds / 60) || ''} placeholder="0" onChange={(e) => setSection(i, { seconds: int(e.target.value) * 60 })} />
                    </label>
                  </div>
                  {flagged && (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {[sc.lowAccuracy && `accuracy ${sc.accuracy}% is below the safety line`, sc.highPenalty && `${sc.penalty} marks lost to negatives`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] px-4 py-3 text-sm">
          <span className="text-ink-300">Net score</span>
          <span className="font-mono tabular-nums text-ink-50" data-testid="mock-net">
            {score.net} / {score.maxMarks}
            {template && template.target_score > 0 && (
              <span className={`ml-2 text-xs ${score.net >= template.target_score ? 'text-brand-300' : 'text-rose-300'}`}>target {template.target_score}</span>
            )}
          </span>
        </div>

        <Field label="Notes">
          {(id) => <textarea id={id} className={`${inputClass} min-h-[64px]`} maxLength={2000} value={form.notes} placeholder="What went right, what to change next mock" onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>

        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save mock' : 'Log mock'}</Button>
        </div>
      </form>
    </Modal>
  )
}
