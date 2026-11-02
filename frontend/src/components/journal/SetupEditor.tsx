import React, { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, Settings2, Download, Upload, X } from 'lucide-react'
import type { JournalCategory, JournalConfig, JournalField, Mistake, Project } from '../../types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/Field'
import { JOURNAL_PRESETS, PALETTE, WEEKDAYS, makeKey, nextColor, optionLabel, parseSetupFile, presetByKey, valuesInUse } from '../../lib/journal'

export interface Retag {
  category: string
  from: string
  to: string
}

interface Props {
  isOpen: boolean
  project: Project | null
  /** The setup currently in effect for the project. */
  current: JournalConfig
  /** True when the project has its own setup (not the default). */
  projectHasOwn: boolean
  mistakes: Mistake[]
  onClose: () => void
  onSave: (scope: 'default' | 'project', config: JournalConfig, retags: Retag[]) => Promise<void>
  onUseDefault: () => Promise<void>
}

type Tab = 'categories' | 'fields' | 'patterns' | 'tests'

const move = <T,>(list: T[], i: number, d: -1 | 1) => {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

const iconBtn = 'focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50 disabled:opacity-30'

/** Everything about the journal a user can change. */
export const SetupEditor: React.FC<Props> = ({ isOpen, project, current, projectHasOwn, mistakes, onClose, onSave, onUseDefault }) => {
  const [cfg, setCfg] = useState<JournalConfig>(() => structuredClone(current))
  const [tab, setTab] = useState<Tab>('categories')
  const [selected, setSelected] = useState(0)
  const [scope, setScope] = useState<'default' | 'project'>(projectHasOwn ? 'project' : 'default')
  const [retags, setRetags] = useState<Retag[]>([])
  const [merging, setMerging] = useState<{ cat: string; from: string; to: string } | null>(null)
  const [newOption, setNewOption] = useState('')
  const [comboDraft, setComboDraft] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openedAt, setOpenedAt] = useState<boolean>(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (isOpen && !openedAt) {
    setOpenedAt(true)
    setCfg(structuredClone(current))
    setScope(projectHasOwn ? 'project' : 'default')
    setRetags([])
    setSelected(0)
    setError(null)
  } else if (!isOpen && openedAt) {
    setOpenedAt(false)
  }

  const cat: JournalCategory | undefined = cfg.categories[selected]
  const setCat = (patch: Partial<JournalCategory>) => setCfg((c) => ({ ...c, categories: c.categories.map((x, i) => (i === selected ? { ...x, ...patch } : x)) }))
  const used = useMemo(() => (cat ? valuesInUse(mistakes, cat.key) : []), [mistakes, cat])
  const usedCount = (key: string, value: string) => valuesInUse(mistakes, key).find((v) => v.value === value)?.count ?? 0

  const applyPreset = (key: string) => {
    const p = presetByKey(key)
    if (!p) return
    setCfg(structuredClone(p.config))
    setSelected(0)
  }

  const addCategory = () => {
    const key = makeKey('New category', cfg.categories.map((c) => c.key))
    setCfg((c) => ({ ...c, categories: [...c.categories, { key, label: 'New category', multi: false, required: false, allow_new: true, options: [] }] }))
    setSelected(cfg.categories.length)
  }
  const removeCategory = (i: number) => {
    const c = cfg.categories[i]
    setCfg((x) => ({
      ...x,
      categories: x.categories.filter((_, j) => j !== i),
      patterns: { ...x.patterns, watch: x.patterns.watch.map((w) => w.filter((k) => k !== c.key)).filter((w) => w.length > 0) },
    }))
    setSelected(0)
  }
  const addOption = () => {
    if (!cat || !newOption.trim()) return
    const key = makeKey(newOption, cat.options.map((o) => o.key))
    setCat({ options: [...cat.options, { key, label: newOption.trim().slice(0, 40), color: nextColor(cat.options) }] })
    setNewOption('')
  }
  const removeOption = (key: string) => {
    if (!cat) return
    if (usedCount(cat.key, key) > 0) {
      setMerging({ cat: cat.key, from: key, to: cat.options.find((o) => o.key !== key)?.key ?? '' })
      return
    }
    setCat({ options: cat.options.filter((o) => o.key !== key) })
  }
  const confirmMerge = () => {
    if (!merging || !cat) return
    setRetags((r) => [...r, { category: merging.cat, from: merging.from, to: merging.to }])
    if (cat.options.some((o) => o.key === merging.from)) setCat({ options: cat.options.filter((o) => o.key !== merging.from) })
    setMerging(null)
  }

  const setField = (key: string, patch: Partial<JournalField>) => setCfg((c) => ({ ...c, fields: c.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }))
  const addField = () => {
    const key = makeKey('Custom field', [...cfg.fields.map((f) => f.key), ...cfg.categories.map((c) => c.key)])
    setCfg((c) => ({ ...c, fields: [...c.fields, { key, label: 'Custom field', type: 'text', hidden: false }] }))
  }

  const exportSetup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `mistake-journal-setup-${cfg.preset || 'custom'}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const importSetup = async (file: File) => {
    const parsed = parseSetupFile(await file.text())
    if (!parsed) setError('That file is not a mistake-journal setup.')
    else {
      setCfg(parsed)
      setSelected(0)
      setError(null)
    }
  }

  const submit = async () => {
    if (cfg.categories.some((c) => !c.label.trim() || (!c.allow_new && c.options.length === 0))) {
      setError('Every category needs a name, and categories that do not allow new values need at least one option.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(scope, cfg, retags)
      onClose()
    } catch {
      /* toast shown by caller */
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'categories', label: 'Categories' },
    { id: 'fields', label: 'Fields' },
    { id: 'patterns', label: 'Patterns & review' },
    { id: 'tests', label: 'Tests' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Customize your mistake journal" description="Your own categories, fields and rules. Renaming never changes logged mistakes." icon={<Settings2 className="h-5 w-5" aria-hidden="true" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs text-ink-300">
            Start from a preset
            <select className={`${inputClass} mt-1`} value={JOURNAL_PRESETS.some((p) => p.key === cfg.preset) ? cfg.preset : ''} onChange={(e) => applyPreset(e.target.value)}>
              {!JOURNAL_PRESETS.some((p) => p.key === cfg.preset) && <option value="">Custom</option>}
              {JOURNAL_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-ink-500">{presetByKey(cfg.preset)?.description ?? 'Your own setup.'}</span>
          </label>
          <fieldset className="text-xs text-ink-300">
            <legend>Use this setup for</legend>
            <div className="mt-1 space-y-1">
              <label className="flex items-center gap-2"><input type="radio" name="setup-scope" checked={scope === 'default'} onChange={() => setScope('default')} className="accent-brand-500" />All my projects (my default)</label>
              {project && <label className="flex items-center gap-2"><input type="radio" name="setup-scope" checked={scope === 'project'} onChange={() => setScope('project')} className="accent-brand-500" />Only {project.name}</label>}
            </div>
          </fieldset>
        </div>

        <div role="tablist" aria-label="Setup sections" className="flex gap-1 overflow-x-auto rounded-xl border border-fg/[0.06] bg-surface-950/60 p-1">
          {tabs.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`focus-ring whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${tab === t.id ? 'bg-fg/[0.08] text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>{t.label}</button>
          ))}
        </div>

        {tab === 'categories' && (
          <div role="tabpanel" aria-label="Categories" className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
            <div>
              <ul className="space-y-1">
                {cfg.categories.map((c, i) => (
                  <li key={c.key} className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${i === selected ? 'border-brand-500/30 bg-brand-500/[0.07]' : 'border-fg/[0.06]'}`}>
                    <button type="button" onClick={() => setSelected(i)} className="focus-ring min-w-0 flex-1 truncate rounded text-left text-sm text-ink-100" aria-current={i === selected}>{c.label || 'Untitled'}</button>
                    <button type="button" aria-label={`Move ${c.label} up`} disabled={i === 0} className={iconBtn} onClick={() => { setCfg((x) => ({ ...x, categories: move(x.categories, i, -1) })); setSelected(Math.max(0, i - 1)) }}><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" aria-label={`Move ${c.label} down`} disabled={i === cfg.categories.length - 1} className={iconBtn} onClick={() => { setCfg((x) => ({ ...x, categories: move(x.categories, i, 1) })); setSelected(Math.min(cfg.categories.length - 1, i + 1)) }}><ArrowDown className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" className="mt-2" disabled={cfg.categories.length >= 12} onClick={addCategory} icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>Add category</Button>
            </div>
            {cat && (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <label className="flex-1 text-xs text-ink-300">
                    Category name
                    <input aria-label="Category name" className={`${inputClass} mt-1`} maxLength={40} value={cat.label} onChange={(e) => setCat({ label: e.target.value })} />
                  </label>
                  <Button size="sm" variant="ghost" disabled={cfg.categories.length === 1} onClick={() => removeCategory(selected)} icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}>Remove</Button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-200">
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-brand-500" checked={cat.required} onChange={(e) => setCat({ required: e.target.checked })} />Required</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-brand-500" checked={cat.multi} onChange={(e) => setCat({ multi: e.target.checked })} />Allow several values</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-brand-500" checked={cat.allow_new} onChange={(e) => setCat({ allow_new: e.target.checked })} />Let me type new values</label>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-300">{cat.allow_new ? 'Suggested values' : 'Options'}</p>
                  <ul className="space-y-1">
                    {cat.options.map((o, i) => (
                      <li key={o.key} className="flex items-center gap-1.5">
                        <div className="flex shrink-0 gap-0.5" role="radiogroup" aria-label={`Colour for ${o.label}`}>
                          {PALETTE.map((c) => (
                            <button key={c} type="button" role="radio" aria-checked={o.color === c} aria-label={c} onClick={() => setCat({ options: cat.options.map((x) => (x.key === o.key ? { ...x, color: c } : x)) })} className={`h-4 w-4 rounded-full ${o.color === c ? 'ring-2 ring-ink-50 ring-offset-1 ring-offset-surface-900' : ''}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <input aria-label={`Option ${i + 1} name`} className={`${inputClass} h-8 py-0 text-xs`} maxLength={40} value={o.label} onChange={(e) => setCat({ options: cat.options.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)) })} />
                        <span className="w-10 shrink-0 text-right font-mono text-[10px] text-ink-500" title="Mistakes using it">{usedCount(cat.key, o.key) || ''}</span>
                        <button type="button" aria-label={`Move ${o.label} up`} disabled={i === 0} className={iconBtn} onClick={() => setCat({ options: move(cat.options, i, -1) })}><ArrowUp className="h-3 w-3" /></button>
                        <button type="button" aria-label={`Delete ${o.label}`} className={iconBtn} onClick={() => removeOption(o.key)}><Trash2 className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <input aria-label="New option" className={`${inputClass} h-8 py-0 text-xs`} maxLength={40} placeholder={`Add ${cat.allow_new ? 'a suggestion' : 'an option'}`} value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }} />
                    <Button size="sm" variant="secondary" onClick={addOption} disabled={!newOption.trim() || cat.options.length >= 200}>Add</Button>
                  </div>
                </div>
                {cat.allow_new && used.filter((u) => !cat.options.some((o) => o.key === u.value)).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-ink-300">Typed values in your mistakes</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {used.filter((u) => !cat.options.some((o) => o.key === u.value)).slice(0, 30).map((u) => (
                        <li key={u.value}>
                          <button type="button" onClick={() => setMerging({ cat: cat.key, from: u.value, to: '' })} className="focus-ring chip border-fg/[0.08] bg-fg/[0.03] text-ink-200 hover:bg-fg/[0.07]" title="Rename or merge">
                            {u.value} <span className="font-mono text-ink-500">{u.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {merging && merging.cat === cat.key && (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-ink-100" role="group" aria-label="Merge values">
                    <p className="mb-2">
                      <strong>{optionLabel(cat, merging.from)}</strong> is used by {usedCount(cat.key, merging.from)} mistakes. Move them to:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {cat.allow_new ? (
                        <input aria-label="Rename to" className={`${inputClass} h-8 w-48 py-0 text-xs`} list="merge-targets" maxLength={80} value={merging.to} placeholder="New name, or an existing value" onChange={(e) => setMerging({ ...merging, to: e.target.value })} />
                      ) : (
                        <select aria-label="Move to" className={`${inputClass} h-8 w-48 py-0 text-xs`} value={merging.to} onChange={(e) => setMerging({ ...merging, to: e.target.value })}>
                          {cat.options.filter((o) => o.key !== merging.from).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                          <option value="">Remove from those mistakes</option>
                        </select>
                      )}
                      <datalist id="merge-targets">{cat.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</datalist>
                      <Button size="sm" onClick={confirmMerge} disabled={cat.allow_new && !merging.to.trim()}>Apply on save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setMerging(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'fields' && (
          <div role="tabpanel" aria-label="Fields" className="space-y-2">
            {cfg.fields.map((f) => (
              <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-fg/[0.06] px-2 py-1.5">
                <input aria-label={`Label for ${f.label}`} className={`${inputClass} h-8 min-w-[10rem] flex-1 py-0 text-xs`} maxLength={40} value={f.label} onChange={(e) => setField(f.key, { label: e.target.value })} />
                {f.type === 'builtin' ? (
                  <span className="text-[11px] text-ink-500">Built in</span>
                ) : (
                  <select aria-label={`Type of ${f.label}`} className={`${inputClass} h-8 w-auto py-0 text-xs`} value={f.type} onChange={(e) => setField(f.key, { type: e.target.value as JournalField['type'], options: e.target.value === 'select' ? f.options ?? ['Option 1'] : undefined })}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="yesno">Yes / no</option>
                    <option value="select">Choice</option>
                  </select>
                )}
                {f.type === 'select' && (
                  <input aria-label={`Choices for ${f.label}`} className={`${inputClass} h-8 min-w-[10rem] flex-1 py-0 text-xs`} placeholder="Choices, separated by commas" defaultValue={(f.options ?? []).join(', ')} onBlur={(e) => setField(f.key, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30) })} />
                )}
                <label className="flex items-center gap-1 text-xs text-ink-300"><input type="checkbox" className="accent-brand-500" checked={!f.hidden} onChange={(e) => setField(f.key, { hidden: !e.target.checked })} />Show</label>
                {f.type !== 'builtin' && <button type="button" aria-label={`Delete ${f.label}`} className={iconBtn} onClick={() => setCfg((c) => ({ ...c, fields: c.fields.filter((x) => x.key !== f.key) }))}><X className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            <Button size="sm" variant="ghost" disabled={cfg.fields.filter((f) => f.type !== 'builtin').length >= 10} onClick={addField} icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>Add custom field</Button>
          </div>
        )}

        {tab === 'patterns' && (
          <div role="tabpanel" aria-label="Patterns and review" className="space-y-4 text-xs text-ink-300">
            <div className="flex flex-wrap items-center gap-2">
              Flag a pattern when the same thing goes wrong
              <input aria-label="Times" type="number" min={2} max={20} className={`${inputClass} h-8 w-16 py-0 text-xs`} value={cfg.patterns.threshold} onChange={(e) => setCfg((c) => ({ ...c, patterns: { ...c.patterns, threshold: Math.max(2, Math.min(20, Number(e.target.value) || 2)) } }))} />
              times in
              <input aria-label="Days" type="number" min={1} max={90} className={`${inputClass} h-8 w-16 py-0 text-xs`} value={cfg.patterns.window_days} onChange={(e) => setCfg((c) => ({ ...c, patterns: { ...c.patterns, window_days: Math.max(1, Math.min(90, Number(e.target.value) || 1)) } }))} />
              days.
            </div>
            <div>
              <p className="mb-1.5 font-medium">Watch these combinations</p>
              <ul className="flex flex-wrap gap-1.5">
                {cfg.patterns.watch.map((w, i) => (
                  <li key={i} className="chip border-fg/[0.08] bg-fg/[0.04] text-ink-100">
                    {w.map((k) => cfg.categories.find((c) => c.key === k)?.label ?? k).join(' + ')}
                    <button type="button" aria-label="Stop watching" className="focus-ring rounded text-ink-400 hover:text-ink-50" onClick={() => setCfg((c) => ({ ...c, patterns: { ...c.patterns, watch: c.patterns.watch.filter((_, j) => j !== i) } }))}><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {cfg.categories.map((c) => (
                  <label key={c.key} className="flex items-center gap-1"><input type="checkbox" className="accent-brand-500" checked={comboDraft.includes(c.key)} disabled={!comboDraft.includes(c.key) && comboDraft.length >= 3} onChange={(e) => setComboDraft((d) => (e.target.checked ? [...d, c.key] : d.filter((x) => x !== c.key)))} />{c.label}</label>
                ))}
                <Button size="sm" variant="secondary" disabled={comboDraft.length === 0 || cfg.patterns.watch.length >= 6} onClick={() => { setCfg((c) => ({ ...c, patterns: { ...c.patterns, watch: [...c.patterns.watch, comboDraft] } })); setComboDraft([]) }}>Watch</Button>
              </div>
            </div>
            <label className="flex flex-wrap items-center gap-2">
              Weekly review day
              <select className={`${inputClass} h-8 w-auto py-0 text-xs`} value={cfg.review_weekday} onChange={(e) => setCfg((c) => ({ ...c, review_weekday: Number(e.target.value) }))}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
          </div>
        )}

        {tab === 'tests' && (
          <div role="tabpanel" aria-label="Tests" className="space-y-2 text-xs text-ink-300">
            <label className="flex items-center gap-2 text-sm text-ink-100"><input type="checkbox" className="accent-brand-500" checked={cfg.tests_enabled} onChange={(e) => setCfg((c) => ({ ...c, tests_enabled: e.target.checked }))} />Track test scores</label>
            <p>Adds a Tests view where you log scores per section, link mistakes to a test, and see your score trend against a target. Each project sets its own test format there.</p>
          </div>
        )}

        {retags.length > 0 && <p className="text-[11px] text-amber-200">{retags.length} merge{retags.length === 1 ? '' : 's'} will be applied to your mistakes when you save.</p>}
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={exportSetup} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>Export</Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} icon={<Upload className="h-3.5 w-3.5" aria-hidden="true" />}>Import</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import a setup file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSetup(f); e.target.value = '' }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {projectHasOwn && project && <Button variant="ghost" onClick={() => void onUseDefault().then(onClose).catch(() => undefined)}>Use my default for {project.name}</Button>}
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void submit()} loading={saving}>Save setup</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
