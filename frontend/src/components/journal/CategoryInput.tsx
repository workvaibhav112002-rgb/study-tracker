import { useId, useState } from 'react'
import { X } from 'lucide-react'
import type { JournalCategory } from '../../types'
import { inputClass } from '../ui/Field'
import { normalizeValue, optionColor, optionLabel } from '../../lib/journal'

interface Props {
  cat: JournalCategory
  value: string | string[] | undefined
  onChange: (v: string | string[] | undefined) => void
  /** Values already used for this category, most used first (free-text suggestions). */
  used: string[]
}

const MAX_PILLS = 8

const pillClass = (on: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400/60 ${
    on ? 'border-fg/25 bg-fg/[0.12] text-ink-50' : 'border-fg/[0.08] bg-fg/[0.03] text-ink-300 hover:bg-fg/[0.07]'
  }`

/**
 * One category of the mistake form. Short fixed lists are keyboard pills
 * (native radios or checkboxes), long fixed lists a select, and open lists a
 * text box with suggestions plus pills for the most used values.
 */
export function CategoryInput({ cat, value, onChange, used }: Props) {
  const name = useId()
  const listId = useId()
  const values = Array.isArray(value) ? value : value ? [value] : []
  const suggestions = [...new Set([...cat.options.map((o) => o.key), ...used])]
  const pills = cat.allow_new ? suggestions.slice(0, MAX_PILLS) : cat.options.length <= MAX_PILLS ? cat.options.map((o) => o.key) : []
  // Single free-text categories show what was typed (or a saved value that is not a pill).
  const [draft, setDraft] = useState(() => (!cat.multi && values[0] && !pills.includes(values[0]) ? optionLabel(cat, values[0]) : ''))
  const label = (
    <legend className="mb-1.5 text-xs font-medium text-ink-300">
      {cat.label}
      {cat.required && <span className="text-rose-300" aria-hidden="true"> *</span>}
      {cat.required && <span className="sr-only"> (required)</span>}
    </legend>
  )

  const toggle = (v: string) => {
    if (cat.multi) onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v].slice(0, 10))
    else {
      setDraft('')
      onChange(v)
    }
  }
  const addTyped = () => {
    const v = normalizeValue(cat, draft)
    if (!v) return
    if (cat.multi) onChange([...new Set([...values, v])].slice(0, 10))
    setDraft('')
  }

  return (
    <fieldset>
      {label}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pills.map((v) => {
            const on = values.includes(v)
            return (
              <label key={v} className={pillClass(on)}>
                <input type={cat.multi ? 'checkbox' : 'radio'} className="sr-only" name={name} value={v} checked={on} onChange={() => toggle(v)} />
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: optionColor(cat, v) }} aria-hidden="true" />
                {optionLabel(cat, v)}
              </label>
            )
          })}
        </div>
      )}
      {!cat.allow_new && cat.options.length > MAX_PILLS && !cat.multi && (
        <select aria-label={cat.label} className={inputClass} value={values[0] ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Choose…</option>
          {cat.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      )}
      {cat.allow_new && (
        <>
          {cat.multi && values.filter((v) => !pills.includes(v)).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {values.filter((v) => !pills.includes(v)).map((v) => (
                <span key={v} className="chip border-fg/15 bg-fg/[0.08] text-ink-100">
                  {optionLabel(cat, v)}
                  <button type="button" aria-label={`Remove ${optionLabel(cat, v)}`} onClick={() => toggle(v)} className="focus-ring rounded text-ink-400 hover:text-ink-50"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <input
            aria-label={pills.length ? `Or type a ${cat.label.toLowerCase()}` : cat.label}
            list={listId}
            className={`${inputClass} ${pills.length ? 'mt-2' : ''}`}
            maxLength={80}
            placeholder={cat.multi ? `Type and press Enter to add` : pills.length ? `Or type a ${cat.label.toLowerCase()}` : `e.g. a ${cat.label.toLowerCase()}`}
            value={draft}
            onChange={(e) => {
              if (cat.multi) setDraft(e.target.value)
              else {
                setDraft(e.target.value)
                onChange(e.target.value.trim() ? normalizeValue(cat, e.target.value) : undefined)
              }
            }}
            onKeyDown={(e) => {
              if (cat.multi && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault()
                addTyped()
              }
            }}
            onBlur={() => cat.multi && addTyped()}
          />
          <datalist id={listId}>
            {suggestions.map((v) => <option key={v} value={optionLabel(cat, v)} />)}
          </datalist>
        </>
      )}
    </fieldset>
  )
}
