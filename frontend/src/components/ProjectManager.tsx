import React, { useState } from 'react'
import { Plus, Trash2, Pencil, FolderKanban, Target, Clock, Check } from 'lucide-react'
import type { Project, ProjectInput } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Skeleton } from './ui/Skeleton'
import { formatMinutes } from '../lib/time'

interface ProjectManagerProps {
  projects: Project[]
  loading?: boolean
  onCreateProject: (project: ProjectInput) => Promise<void>
  onUpdateProject: (id: number, project: ProjectInput) => Promise<void>
  onDeleteProject: (id: number) => Promise<void>
  /** Externally request the create dialog (e.g. from the timer). */
  openCreateSignal?: number
}

/** Colorblind-safe categorical set, validated for the dark surface. */
const PRESET_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  loading = false,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  openCreateSignal = 0,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [description, setDescription] = useState('')
  const [targetMinutes, setTargetMinutes] = useState(60)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    setDescription('')
    setTargetMinutes(60)
    setIsModalOpen(true)
  }

  const [seenSignal, setSeenSignal] = useState(openCreateSignal)
  if (openCreateSignal !== seenSignal) {
    setSeenSignal(openCreateSignal)
    openCreate()
  }

  const openEdit = (p: Project) => {
    setEditing(p)
    setName(p.name)
    setColor(p.color)
    setDescription(p.description || '')
    setTargetMinutes(p.target_minutes_per_day || 60)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input: ProjectInput = { name: name.trim(), color, description: description.trim(), target_minutes_per_day: targetMinutes }
    if (!input.name) return
    setSaving(true)
    try {
      if (editing) await onUpdateProject(editing.id, input)
      else await onCreateProject(input)
      setIsModalOpen(false)
    } catch {
      /* surfaced by caller */
    } finally {
      setSaving(false)
    }
  }

  const totalMinutes = projects.reduce((sum, p) => sum + (p.total_minutes ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Workspace</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">Projects</h2>
          <p className="mt-1.5 text-sm text-ink-400">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'} · {formatMinutes(totalMinutes)} logged in total
          </p>
        </div>
        <Button size="lg" onClick={openCreate} icon={<Plus className="h-4 w-4" aria-hidden="true" />} className="shrink-0">
          <span className="hidden sm:inline">New project</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
            <FolderKanban className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-ink-50">No projects yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-ink-400">Create your first project to start logging focus sessions against it.</p>
          <Button className="mt-6" onClick={openCreate} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            Create a project
          </Button>
        </div>
      ) : (
        <ul className="stagger m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="card card-hover group relative flex flex-col justify-between overflow-hidden p-5">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-25"
                style={{ background: p.color }}
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04]" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 12px ${p.color}` }} />
                    </span>
                    <h3 className="truncate text-[15px] font-semibold text-ink-50">{p.name}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="focus-ring rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(p)}
                      aria-label={`Delete ${p.name}`}
                      className="focus-ring rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[36px] text-[13px] leading-relaxed text-ink-400">{p.description || 'No description yet.'}</p>
              </div>

              <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                <span className="flex items-center gap-1.5 text-ink-400">
                  <Target className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                  <span className="font-semibold text-ink-100">{p.target_minutes_per_day}m</span> / day
                </span>
                <span className="flex items-center gap-1.5 text-ink-400">
                  <Clock className="h-3.5 w-3.5 text-accent-sky" aria-hidden="true" />
                  <span className="font-semibold text-ink-100">{formatMinutes(p.total_minutes ?? 0)}</span> logged
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={saving ? undefined : () => setIsModalOpen(false)}
        dismissible={!saving}
        title={editing ? 'Edit project' : 'New project'}
        description={editing ? 'Update the details below.' : 'Group your study time by subject or goal.'}
        icon={<FolderKanban className="h-5 w-5" />}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Name">
            {(id) => (
              <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Distributed Systems in Go" className={inputClass} maxLength={100} required autoFocus />
            )}
          </Field>

          <div>
            <span className="mb-2 block text-xs font-medium text-ink-300">Color</span>
            <div role="radiogroup" aria-label="Badge color" className="flex flex-wrap items-center gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ease-premium ${
                    color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-surface-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 16px ${c}` : undefined }}
                >
                  {color === c && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>

          <Field label="Daily goal (minutes)">
            {(id) => <input id={id} type="number" min={1} max={1440} value={targetMinutes} onChange={(e) => setTargetMinutes(Number(e.target.value))} className={inputClass} required />}
          </Field>

          <Field label="Description">
            {(id) => (
              <textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Topics, books or goals included in this project" rows={2} maxLength={500} className={`${inputClass} resize-none`} />
            )}
          </Field>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        message="All study sessions logged against this project will be deleted too. This cannot be undone."
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await onDeleteProject(pendingDelete.id)
            setPendingDelete(null)
          } catch {
            /* surfaced by caller */
          }
        }}
      />
    </div>
  )
}
