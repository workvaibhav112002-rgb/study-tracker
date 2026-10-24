import React, { useMemo, useState } from 'react'
import { NotebookPen, Plus, Pin, PinOff, Trash2, Search, ChevronDown, Eye, PencilLine } from 'lucide-react'
import type { Note, NoteInput, Project } from '../types'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { Modal } from './ui/Modal'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Skeleton } from './ui/Skeleton'
import { renderMarkdown } from '../lib/markdown'
import { formatDateTime } from '../lib/time'

interface Props {
  projects: Project[]
  notes: Note[]
  loading: boolean
  onAdd: (input: NoteInput) => Promise<Note>
  onEdit: (id: number, input: NoteInput) => Promise<Note>
  onRemove: (id: number) => Promise<void>
  newNoteSignal?: number
}

export const NotesPanel: React.FC<Props> = ({ projects, notes, loading, onAdd, onEdit, onRemove, newNoteSignal = 0 }) => {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [projectFilter, setProjectFilter] = useState<number | 'all'>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [projectId, setProjectId] = useState<number | ''>('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setBody('')
    setTags('')
    setProjectId(projectFilter === 'all' ? '' : projectFilter)
    setPreview(false)
    setEditorOpen(true)
  }
  const [seen, setSeen] = useState(newNoteSignal)
  if (newNoteSignal !== seen) {
    setSeen(newNoteSignal)
    openCreate()
  }
  const openEdit = (n: Note) => {
    setEditing(n)
    setTitle(n.title)
    setBody(n.body)
    setTags(n.tags.join(', '))
    setProjectId(n.project_id ?? '')
    setPreview(false)
    setEditorOpen(true)
  }

  const allTags = useMemo(() => Array.from(new Set(notes.flatMap((n) => n.tags))).sort(), [notes])
  const visible = notes.filter((n) => {
    if (projectFilter !== 'all' && n.project_id !== projectFilter) return false
    if (tag && !n.tags.includes(tag)) return false
    const q = query.trim().toLowerCase()
    return !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const input: NoteInput = { project_id: projectId === '' ? null : projectId, title: title.trim(), body, tags: tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean), pinned: editing?.pinned ?? false }
    try {
      if (editing) await onEdit(editing.id, input)
      else await onAdd(input)
      setEditorOpen(false)
    } catch {
      /* surfaced upstream */
    } finally {
      setSaving(false)
    }
  }

  const togglePin = (n: Note) => void onEdit(n.id, { project_id: n.project_id, title: n.title, body: n.body, tags: n.tags, pinned: !n.pinned }).catch(() => undefined)
  const projectName = (id: number | null) => projects.find((p) => p.id === id)?.name

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Knowledge</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">Notes</h2>
          <p className="mt-1.5 text-sm text-ink-400">{notes.length} {notes.length === 1 ? 'note' : 'notes'} · Markdown supported</p>
        </div>
        <Button size="lg" onClick={openCreate} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>New note</Button>
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" aria-label="Search notes" className={`${inputClass} h-10 py-0 pl-10`} />
        </div>
        <div className="relative">
          <label htmlFor="notes-project" className="sr-only">Project</label>
          <select id="notes-project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="focus-ring glass h-10 w-full cursor-pointer appearance-none rounded-xl pl-3.5 pr-9 text-[13px] font-medium text-ink-200 sm:w-48">
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        </div>
      </div>
      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {allTags.map((t) => (
            <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)} className={`focus-ring chip transition ${tag === t ? 'border-brand-500/30 bg-brand-500/15 text-brand-300' : 'border-fg/[0.06] bg-fg/[0.04] text-ink-400 hover:text-ink-100'}`}>#{t}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2" role="status" aria-label="Loading notes">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}</div>
      ) : visible.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-fg/[0.06] bg-fg/[0.04] text-ink-400"><NotebookPen className="h-6 w-6" aria-hidden="true" /></div>
          <h3 className="text-base font-semibold text-ink-50">{notes.length === 0 ? 'No notes yet' : 'Nothing matches'}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-ink-400">Capture what you learned, link it to a project, tag it, find it later.</p>
        </div>
      ) : (
        <ul className="stagger grid gap-3 md:grid-cols-2">
          {visible.map((n) => (
            <li key={n.id} className="card card-hover group flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => openEdit(n)} className="focus-ring min-w-0 flex-1 rounded text-left">
                  <h3 className="truncate text-[15px] font-semibold text-ink-50">{n.title}</h3>
                  <p className="mt-0.5 text-[11px] text-ink-500">{projectName(n.project_id) ?? 'No project'} · {n.updated_at ? formatDateTime(n.updated_at) : ''}</p>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
                  <button type="button" onClick={() => togglePin(n)} aria-label={n.pinned ? 'Unpin note' : 'Pin note'} className={`focus-ring rounded-lg p-1.5 hover:bg-fg/[0.06] ${n.pinned ? 'text-brand-400' : 'text-ink-500 hover:text-ink-50'}`}>{n.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}</button>
                  <button type="button" onClick={() => setPendingDelete(n)} aria-label="Delete note" className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="prose-card mt-3 line-clamp-4 text-sm leading-relaxed text-ink-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body || '_Empty note_') }} />
              {n.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{n.tags.map((t) => <span key={t} className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-400">#{t}</span>)}</div>}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={editorOpen} onClose={saving ? undefined : () => setEditorOpen(false)} dismissible={!saving} title={editing ? 'Edit note' : 'New note'} icon={<NotebookPen className="h-5 w-5" />} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title">{(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} maxLength={200} required autoFocus />}</Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Project">{(id) => (
              <select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}</Field>
            <Field label="Tags">{(id) => <input id={id} value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="chapter-3, formulas" />}</Field>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-300">Body</span>
              <button type="button" onClick={() => setPreview((p) => !p)} className="focus-ring flex items-center gap-1 rounded text-xs font-medium text-ink-400 hover:text-ink-100">
                {preview ? <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="prose-card min-h-[200px] rounded-xl border border-fg/[0.08] bg-surface-950/80 p-3.5 text-sm text-ink-200" dangerouslySetInnerHTML={{ __html: renderMarkdown(body || '_Nothing yet_') }} />
            ) : (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={20000} aria-label="Body" className={`${inputClass} font-mono text-[13px]`} placeholder={'# Heading\\n\\nWrite in **Markdown**. Lists, `code` and links work.'} />
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save note' : 'Create note'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={pendingDelete !== null} title={`Delete "${pendingDelete?.title}"?`} message="This note will be removed permanently." onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (!pendingDelete) return; try { await onRemove(pendingDelete.id); setPendingDelete(null) } catch { /* surfaced */ } }} />
    </div>
  )
}
