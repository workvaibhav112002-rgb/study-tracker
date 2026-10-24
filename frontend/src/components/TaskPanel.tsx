import React, { useState } from 'react'
import { Check, ChevronDown, ChevronUp, ListChecks, Minus, Plus, Target, Trash2 } from 'lucide-react'
import type { Task } from '../types'
import { Button } from './ui/Button'
import { inputClass } from './ui/Field'

interface TaskPanelProps {
  projectName: string
  tasks: Task[]
  currentTaskId: number | null
  onAdd: (title: string, estimate: number) => Promise<void>
  onToggle: (id: number, done: boolean) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onMove: (id: number, dir: -1 | 1) => Promise<void>
  onSetCurrent: (id: number | null) => void
}

const swallow = (p: Promise<void>) => p.catch(() => undefined)

export const TaskPanel: React.FC<TaskPanelProps> = ({ projectName, tasks, currentTaskId, onAdd, onToggle, onRemove, onMove, onSetCurrent }) => {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState(1)
  const [adding, setAdding] = useState(false)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.length - open.length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setAdding(true)
    try {
      await onAdd(t, estimate)
      setTitle('')
      setEstimate(1)
    } catch {
      /* surfaced upstream */
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="card mt-6 w-full p-5" aria-label={`Tasks for ${projectName}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-brand-400">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink-50">Tasks</h3>
            <p className="text-[11px] text-ink-500">
              {tasks.length === 0 ? 'What will you work on?' : `${done} of ${tasks.length} done`}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mb-3 flex items-center gap-2">
        <label htmlFor="task-title" className="sr-only">
          New task
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task for this session…"
          maxLength={200}
          className={`${inputClass} h-10 py-0`}
        />
        <div className="flex h-10 shrink-0 items-center rounded-xl border border-white/[0.08] bg-surface-950/80 px-1" role="group" aria-label="Estimate in pomodoros">
          <button type="button" onClick={() => setEstimate((n) => Math.max(1, n - 1))} aria-label="Decrease estimate" className="focus-ring rounded-lg p-1.5 text-ink-400 hover:text-ink-50">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-9 text-center font-mono text-xs tabular-nums text-ink-100" aria-live="polite">
            {estimate}×
          </span>
          <button type="button" onClick={() => setEstimate((n) => Math.min(20, n + 1))} aria-label="Increase estimate" className="focus-ring rounded-lg p-1.5 text-ink-400 hover:text-ink-50">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button type="submit" size="lg" loading={adding} disabled={!title.trim()} icon={<Plus className="h-4 w-4" aria-hidden="true" />} className="shrink-0">
          Add
        </Button>
      </form>

      {tasks.length > 0 && (
        <ul role="list" className="space-y-1.5">
          {tasks.map((t, i) => {
            const current = t.id === currentTaskId
            const openIdx = open.findIndex((o) => o.id === t.id)
            return (
              <li
                key={t.id}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                  current ? 'border-brand-500/30 bg-brand-500/[0.07]' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'
                } ${t.done ? 'opacity-60' : ''}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={t.done}
                  aria-label={`Mark ${t.title} ${t.done ? 'not done' : 'done'}`}
                  onClick={() => void swallow(onToggle(t.id, !t.done))}
                  className={`focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    t.done ? 'border-brand-500 bg-brand-500 text-surface-950' : 'border-white/20 hover:border-brand-400'
                  }`}
                >
                  {t.done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${t.done ? 'line-through text-ink-500' : 'text-ink-100'}`}>{t.title}</span>
                <span className="chip border-white/[0.06] bg-white/[0.04] font-mono tabular-nums text-ink-400" title="Completed / estimated pomodoros">
                  {t.completed_pomodoros}/{t.estimate_pomodoros}
                </span>
                {!t.done && (
                  <button
                    type="button"
                    aria-pressed={current}
                    aria-label={current ? `${t.title} is the current task` : `Set ${t.title} as current task`}
                    onClick={() => onSetCurrent(current ? null : t.id)}
                    className={`focus-ring rounded-lg p-1.5 transition-colors ${current ? 'text-brand-400' : 'text-ink-600 hover:text-ink-100'}`}
                  >
                    <Target className="h-4 w-4" />
                  </button>
                )}
                <div className="flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  {!t.done && (
                    <>
                      <button type="button" aria-label="Move up" disabled={openIdx <= 0} onClick={() => void swallow(onMove(t.id, -1))} className="focus-ring rounded-lg p-1 text-ink-600 hover:text-ink-100 disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Move down" disabled={openIdx < 0 || openIdx >= open.length - 1} onClick={() => void swallow(onMove(t.id, 1))} className="focus-ring rounded-lg p-1 text-ink-600 hover:text-ink-100 disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button type="button" aria-label={`Delete ${t.title}`} onClick={() => void swallow(onRemove(t.id))} className="focus-ring rounded-lg p-1 text-ink-600 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <span className="sr-only">{i + 1}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
