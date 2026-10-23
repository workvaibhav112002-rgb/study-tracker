import React, { useState } from 'react'
import { Plus, Trash2, Edit3, FolderKanban, Target, Clock, Check } from 'lucide-react'
import type { Project, ProjectInput } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { formatMinutes } from '../lib/time'

interface ProjectManagerProps {
  projects: Project[]
  onCreateProject: (project: ProjectInput) => Promise<void>
  onUpdateProject: (id: number, project: ProjectInput) => Promise<void>
  onDeleteProject: (id: number) => Promise<void>
  /** Externally request the create dialog (e.g. from the timer). */
  openCreateSignal?: number
}

const PRESET_COLORS = ['#22c55e', '#00ADD8', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6']

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
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
    const input: ProjectInput = {
      name: name.trim(),
      color,
      description: description.trim(),
      target_minutes_per_day: targetMinutes,
    }
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-brand-400" aria-hidden="true" />
            Study Projects
          </h2>
          <p className="text-sm text-slate-400 mt-1">Organize topics, set daily targets, and track your cumulative study hours.</p>
        </div>
        <Button size="lg" onClick={openCreate} icon={<Plus className="w-4 h-4" aria-hidden="true" />} className="shrink-0">
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-300">No projects yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Create your first project to start logging focus sessions against it.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
          {projects.map((p) => (
            <li
              key={p.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-4 h-4 rounded-full shadow-sm shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                    <h3 className="font-bold text-base text-white truncate">{p.name}</h3>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(p)}
                      aria-label={`Delete ${p.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 min-h-[32px]">{p.description || 'No description provided.'}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 text-slate-400">
                  <Target className="w-3.5 h-3.5 text-brand-400" aria-hidden="true" />
                  <span>
                    Goal: <strong className="text-slate-200">{p.target_minutes_per_day}m/day</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>
                    Logged: <strong className="text-white">{formatMinutes(p.total_minutes ?? 0)}</strong>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={saving ? undefined : () => setIsModalOpen(false)}
        dismissible={!saving}
        title={editing ? 'Edit Project' : 'Create New Project'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Project Name">
            {(id) => (
              <input
                id={id}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Distributed Systems in Go"
                className={inputClass}
                maxLength={100}
                required
              />
            )}
          </Field>

          <div>
            <span className="block text-xs font-semibold text-slate-300 mb-1.5">Badge Color</span>
            <div role="radiogroup" aria-label="Badge color" className="flex items-center flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-slate-950" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>

          <Field label="Daily Goal (Minutes)">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={1440}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value))}
                className={inputClass}
                required
              />
            )}
          </Field>

          <Field label="Description / Topics">
            {(id) => (
              <textarea
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What topics or books are included in this project?"
                rows={2}
                maxLength={500}
                className={`${inputClass} resize-none`}
              />
            )}
          </Field>

          <div className="flex items-center justify-end space-x-3 pt-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save Changes' : 'Create Project'}
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
