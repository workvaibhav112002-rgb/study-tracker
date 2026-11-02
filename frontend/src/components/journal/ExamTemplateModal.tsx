import React, { useState } from 'react'
import { Plus, Trash2, ClipboardList } from 'lucide-react'
import type { ExamTemplate, Project } from '../../types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, inputClass } from '../ui/Field'
import { EXAM_PRESETS, DEFAULT_TEMPLATE, presetFor } from '../../lib/examTemplates'

interface Props {
  isOpen: boolean
  project: Project
  onClose: () => void
  onSave: (t: ExamTemplate | null) => Promise<void>
}

const num = (v: string) => (v.trim() === '' ? 0 : Number(v))

export const ExamTemplateModal: React.FC<Props> = ({ isOpen, project, onClose, onSave }) => {
  const [t, setT] = useState<ExamTemplate>(() => structuredClone(project.exam_template ?? DEFAULT_TEMPLATE))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seenProject, setSeenProject] = useState(project.id)
  if (seenProject !== project.id) {
    setSeenProject(project.id)
    setT(structuredClone(project.exam_template ?? DEFAULT_TEMPLATE))
  }

  const applyPreset = (key: string) => {
    const p = presetFor(key)
    if (p) setT(structuredClone(p.template))
  }
  const setSection = (i: number, patch: Partial<ExamTemplate['sections'][number]>) =>
    setT((prev) => ({ ...prev, sections: prev.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const totalMarks = t.sections.reduce((a, s) => a + s.questions * s.marks_each, 0)
  const totalMinutes = t.sections.reduce((a, s) => a + s.minutes, 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (t.sections.some((s) => !s.name.trim() || s.questions < 1 || s.marks_each <= 0)) {
      setError('Every section needs a name, at least one question and marks per question.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(t)
      onClose()
    } catch {
      /* toast shown by caller */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={`Test format for ${project.name}`} description="Sections, marking and your target score. For official exams, check the latest notification: formats change." icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Start from a preset">
          {(id) => (
            <select id={id} className={inputClass} value={presetFor(t.key) ? t.key : 'custom'} onChange={(e) => applyPreset(e.target.value)}>
              {EXAM_PRESETS.filter((p) => !p.competitive).map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
              <optgroup label="Competitive exams">
                {EXAM_PRESETS.filter((p) => p.competitive).map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </optgroup>
            </select>
          )}
        </Field>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-300">Sections</legend>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_5rem_5rem_5rem_2rem] gap-2 px-1 text-[11px] text-ink-500 sm:grid">
              <span>Name</span><span>Questions</span><span>Marks each</span><span>Minutes</span><span />
            </div>
            {t.sections.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_5rem_5rem_5rem_2rem]">
                <input aria-label={`Section ${i + 1} name`} className={`${inputClass} col-span-2 sm:col-span-1`} value={s.name} maxLength={40} onChange={(e) => setSection(i, { name: e.target.value })} />
                <input aria-label={`Section ${i + 1} questions`} className={inputClass} type="number" min={1} max={300} value={s.questions} onChange={(e) => setSection(i, { questions: num(e.target.value) })} />
                <input aria-label={`Section ${i + 1} marks each`} className={inputClass} type="number" min={0.25} max={10} step={0.25} value={s.marks_each} onChange={(e) => setSection(i, { marks_each: num(e.target.value) })} />
                <input aria-label={`Section ${i + 1} minutes`} className={inputClass} type="number" min={0} max={300} value={s.minutes} onChange={(e) => setSection(i, { minutes: num(e.target.value) })} />
                <button type="button" aria-label={`Remove section ${i + 1}`} disabled={t.sections.length === 1} onClick={() => setT((prev) => ({ ...prev, sections: prev.sections.filter((_, j) => j !== i) }))} className="focus-ring flex h-10 items-center justify-center rounded-xl text-ink-500 hover:text-rose-300 disabled:opacity-30">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
            <Button size="sm" variant="ghost" disabled={t.sections.length >= 8} onClick={() => setT((prev) => ({ ...prev, sections: [...prev.sections, { name: `Section ${prev.sections.length + 1}`, questions: 30, marks_each: 1, minutes: 20 }] }))} icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>
              Add section
            </Button>
            <span className="tabular-nums">{totalMarks} marks · {totalMinutes} min</span>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Negative marking" hint="Share of marks per wrong answer">
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass} type="number" min={0} max={1} step={0.05} value={t.negative_fraction} onChange={(e) => setT({ ...t, negative_fraction: num(e.target.value) })} />}
          </Field>
          <Field label="Target score" hint="Your cutoff goal">
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass} type="number" min={0} max={10000} step={0.25} value={t.target_score} onChange={(e) => setT({ ...t, target_score: num(e.target.value) })} />}
          </Field>
          <Field label="Accuracy alert (%)" hint="Flag sections below">
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass} type="number" min={0} max={100} value={t.accuracy_threshold} onChange={(e) => setT({ ...t, accuracy_threshold: num(e.target.value) })} />}
          </Field>
          <Field label="Negatives alert" hint="Flag above this many marks">
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass} type="number" min={0} max={1000} step={0.25} value={t.penalty_limit} onChange={(e) => setT({ ...t, penalty_limit: num(e.target.value) })} />}
          </Field>
        </div>

        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {project.exam_template && (
            <Button variant="ghost" onClick={() => void onSave(null).then(onClose).catch(() => undefined)}>Remove format</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save format</Button>
        </div>
      </form>
    </Modal>
  )
}
