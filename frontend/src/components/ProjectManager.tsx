import React, { useState } from 'react'
import { Plus, Trash2, Edit3, FolderKanban, Target, Clock, X, Check } from 'lucide-react'
import { Project } from '../types'

interface ProjectManagerProps {
  projects: Project[]
  onCreateProject: (project: Partial<Project>) => Promise<void>
  onUpdateProject: (id: number, project: Partial<Project>) => Promise<void>
  onDeleteProject: (id: number) => Promise<void>
}

const PRESET_COLORS = [
  '#22c55e', // Emerald
  '#00ADD8', // Go Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#14b8a6', // Teal
]

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [description, setDescription] = useState('')
  const [targetMinutes, setTargetMinutes] = useState(60)

  const openCreateModal = () => {
    setEditingProject(null)
    setName('')
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    setDescription('')
    setTargetMinutes(60)
    setIsModalOpen(true)
  }

  const openEditModal = (p: Project) => {
    setEditingProject(p)
    setName(p.name)
    setColor(p.color)
    setDescription(p.description || '')
    setTargetMinutes(p.target_minutes_per_day || 60)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (editingProject) {
      await onUpdateProject(editingProject.id, {
        name: name.trim(),
        color,
        description: description.trim(),
        target_minutes_per_day: targetMinutes,
      })
    } else {
      await onCreateProject({
        name: name.trim(),
        color,
        description: description.trim(),
        target_minutes_per_day: targetMinutes,
      })
    }
    setIsModalOpen(false)
  }

  const formatHours = (minutes = 0) => {
    const h = (minutes / 60).toFixed(1)
    return `${h} hrs`
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-brand-400" />
            Study Projects
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Organize topics, set daily targets, and track your cumulative study hours.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-sm shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div
            key={p.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div>
              {/* Top Bar with Color Indicator and Actions */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  <h3 className="font-bold text-base text-white">{p.name}</h3>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(p)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${p.name}"? All associated sessions will also be deleted.`)) {
                        onDeleteProject(p.id)
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 min-h-[32px]">
                {p.description || 'No description provided.'}
              </p>
            </div>

            {/* Bottom Metrics */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1 text-slate-400">
                <Target className="w-3.5 h-3.5 text-brand-400" />
                <span>Goal: <strong className="text-slate-200">{p.target_minutes_per_day}m/day</strong></span>
              </div>
              <div className="flex items-center space-x-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Logged: <strong className="text-white">{formatHours(p.total_minutes)}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Distributed Systems in Go"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Badge Color</label>
                <div className="flex items-center space-x-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                        color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-slate-950 font-bold" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Daily Goal (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="720"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description / Topics</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What topics or books are included in this project?"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-xs font-bold shadow-lg shadow-brand-500/20"
                >
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
