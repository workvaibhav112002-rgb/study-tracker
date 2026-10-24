import React, { useState } from 'react'
import { Layers, Plus, Play, Archive, ArchiveRestore, Pencil, Trash2, ChevronDown } from 'lucide-react'
import type { Card, CardInput, CardRating, CardStats, Project } from '../types'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { Modal } from './ui/Modal'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Skeleton } from './ui/Skeleton'
import { ReviewMode } from './ReviewMode'

interface Props {
  projects: Project[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  cards: Card[]
  stats: CardStats
  loading: boolean
  onAdd: (input: CardInput) => Promise<void>
  onEdit: (id: number, input: Omit<CardInput, 'project_id'>) => Promise<void>
  onArchive: (id: number, archived: boolean) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onReview: (id: number, rating: CardRating) => Promise<Card>
  onReviewFinished: (summary: { reviewed: number; again: number; seconds: number }) => void
  startReviewSignal?: number
}

const dueLabel = (c: Card) => {
  const ms = new Date(c.due_at).getTime() - Date.now()
  if (ms <= 0) return 'due now'
  const d = Math.ceil(ms / 86_400_000)
  return d === 1 ? 'tomorrow' : `in ${d}d`
}

export const CardsPanel: React.FC<Props> = ({ projects, selectedProjectId, onSelectProject, cards, stats, loading, onAdd, onEdit, onArchive, onRemove, onReview, onReviewFinished, startReviewSignal = 0 }) => {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState<Card[] | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Card | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const project = projects.find((p) => p.id === selectedProjectId)
  const due = cards.filter((c) => !c.archived && new Date(c.due_at).getTime() <= Date.now())

  const [seen, setSeen] = useState(startReviewSignal)
  if (startReviewSignal !== seen) {
    setSeen(startReviewSignal)
    if (due.length > 0) setReviewing(due)
  }

  const openCreate = () => {
    setEditing(null)
    setFront('')
    setBack('')
    setTags('')
    setEditorOpen(true)
  }
  const openEdit = (c: Card) => {
    setEditing(c)
    setFront(c.front)
    setBack(c.back)
    setTags(c.tags.join(', '))
    setEditorOpen(true)
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return
    setSaving(true)
    const tagList = tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean)
    try {
      if (editing) await onEdit(editing.id, { front: front.trim(), back: back.trim(), tags: tagList })
      else await onAdd({ project_id: selectedProjectId, front: front.trim(), back: back.trim(), tags: tagList })
      setEditorOpen(false)
    } catch {
      /* surfaced upstream */
    } finally {
      setSaving(false)
    }
  }

  const visible = cards.filter((c) => c.archived === showArchived)

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Spaced repetition</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">Flashcards</h2>
          <p className="mt-1.5 text-sm text-ink-400">
            {stats.total} cards · <span className={stats.due > 0 ? 'font-semibold text-brand-300' : ''}>{stats.due} due</span> · {stats.mastered} mastered · {stats.reviewed_last_7_days} reviews this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <label htmlFor="cards-project" className="sr-only">Project</label>
            <select id="cards-project" value={selectedProjectId ?? ''} onChange={(e) => onSelectProject(Number(e.target.value))} className="focus-ring glass h-10 cursor-pointer appearance-none rounded-xl pl-3.5 pr-9 text-[13px] font-medium text-ink-200">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          </div>
          <Button variant="secondary" size="lg" onClick={openCreate} disabled={!selectedProjectId} icon={<Plus className="h-4 w-4 text-brand-400" aria-hidden="true" />}>
            New card
          </Button>
          <Button size="lg" onClick={() => setReviewing(due)} disabled={due.length === 0} icon={<Play className="h-4 w-4" aria-hidden="true" />}>
            Review {due.length > 0 ? `(${due.length})` : ''}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading cards">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
            <Layers className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-ink-50">No cards for {project?.name ?? 'this project'} yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-ink-400">Write a question on the front and the answer on the back. The app schedules reviews so you see each card right before you'd forget it.</p>
          <Button className="mt-6" onClick={openCreate} disabled={!selectedProjectId} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Add your first card</Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-ink-500">{visible.length} {showArchived ? 'archived' : 'active'}</p>
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="focus-ring rounded text-xs font-medium text-ink-400 hover:text-ink-100">
              {showArchived ? 'Show active' : 'Show archived'}
            </button>
          </div>
          <ul className="space-y-2">
            {visible.map((c) => {
              const isDue = !c.archived && new Date(c.due_at).getTime() <= Date.now()
              return (
                <li key={c.id} className="card group flex items-start gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink-50">{c.front}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-400">{c.back}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                      <span className={`chip ${isDue ? 'border-brand-500/20 bg-brand-500/10 text-brand-300' : 'border-fg/[0.06] bg-fg/[0.04] text-ink-400'}`}>{c.archived ? 'archived' : dueLabel(c)}</span>
                      <span>ease {c.ease.toFixed(2)}</span>
                      <span>· {c.repetitions} reps</span>
                      {c.lapses > 0 && <span>· {c.lapses} lapses</span>}
                      {c.tags.map((t) => <span key={t} className="text-ink-500">#{t}</span>)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => openEdit(c)} aria-label="Edit card" className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => void onArchive(c.id, !c.archived).catch(() => undefined)} aria-label={c.archived ? 'Restore card' : 'Archive card'} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-ink-50">
                      {c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setPendingDelete(c)} aria-label="Delete card" className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-fg/[0.06] hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Modal isOpen={editorOpen} onClose={saving ? undefined : () => setEditorOpen(false)} dismissible={!saving} title={editing ? 'Edit card' : 'New card'} description={`${project?.name ?? ''} · Markdown works on both sides`} icon={<Layers className="h-5 w-5" />} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Front (question)">{(id) => <textarea id={id} value={front} onChange={(e) => setFront(e.target.value)} rows={3} maxLength={2000} className={`${inputClass} resize-none`} required autoFocus />}</Field>
          <Field label="Back (answer)">{(id) => <textarea id={id} value={back} onChange={(e) => setBack(e.target.value)} rows={5} maxLength={4000} className={`${inputClass} resize-none`} required />}</Field>
          <Field label="Tags" hint="Comma or space separated, up to 10.">{(id) => <input id={id} value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="concurrency, chapter-3" />}</Field>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save card' : 'Add card'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={pendingDelete !== null} title="Delete this card?" message="Its review history goes with it." onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (!pendingDelete) return; try { await onRemove(pendingDelete.id); setPendingDelete(null) } catch { /* surfaced */ } }} />

      {reviewing && reviewing.length > 0 && (
        <ReviewMode
          cards={reviewing}
          projectName={project?.name ?? 'Cards'}
          onRate={onReview}
          onClose={(summary) => {
            setReviewing(null)
            onReviewFinished(summary)
          }}
        />
      )}
    </div>
  )
}
