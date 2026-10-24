import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { Task } from '../types'

const CURRENT_KEY = 'study_tracker_current_task_v1'

function loadCurrent(userId: number | null): number | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { userId: number | null; taskId: number | null }
    return v.userId === userId ? v.taskId : null
  } catch {
    return null
  }
}

export function clearCurrentTask(): void {
  try {
    localStorage.removeItem(CURRENT_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Tasks for the signed-in user. Loads once per user, filters by project on
 * the client, and applies optimistic updates with rollback on failure.
 */
export function useTasks(userId: number | null, projectId: number | null) {
  const [all, setAll] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [currentTaskId, setCurrentTaskIdState] = useState<number | null>(() => loadCurrent(userId))

  const refresh = useCallback(async () => {
    if (userId === null) return
    setLoading(true)
    try {
      setAll(await api.getTasks())
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId === null) {
      setAll([])
      setCurrentTaskIdState(null)
      return
    }
    setCurrentTaskIdState(loadCurrent(userId))
    void refresh().catch(() => undefined)
  }, [userId, refresh])

  const setCurrentTask = useCallback(
    (taskId: number | null) => {
      setCurrentTaskIdState(taskId)
      try {
        localStorage.setItem(CURRENT_KEY, JSON.stringify({ userId, taskId }))
      } catch {
        /* ignore */
      }
    },
    [userId],
  )

  const tasks = useMemo(() => {
    const list = projectId === null ? all : all.filter((t) => t.project_id === projectId)
    return [...list].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position || a.id - b.id)
  }, [all, projectId])

  // The current task must be open and on the selected project.
  useEffect(() => {
    if (currentTaskId === null) return
    const t = all.find((x) => x.id === currentTaskId)
    if (all.length > 0 && (!t || t.done || (projectId !== null && t.project_id !== projectId))) setCurrentTask(null)
  }, [all, currentTaskId, projectId, setCurrentTask])

  const add = useCallback(async (title: string, estimate: number) => {
    if (projectId === null) return
    const created = await api.createTask({ project_id: projectId, title, estimate_pomodoros: estimate })
    setAll((prev) => [...prev, created])
  }, [projectId])

  const toggle = useCallback(async (id: number, done: boolean) => {
    const before = all
    setAll((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)))
    try {
      const updated = await api.setTaskDone(id, done)
      setAll((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (err) {
      setAll(before)
      throw err
    }
  }, [all])

  const rename = useCallback(async (id: number, title: string, estimate: number) => {
    const updated = await api.updateTask(id, { title, estimate_pomodoros: estimate })
    setAll((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }, [])

  const remove = useCallback(async (id: number) => {
    const before = all
    setAll((prev) => prev.filter((t) => t.id !== id))
    try {
      await api.deleteTask(id)
    } catch (err) {
      setAll(before)
      throw err
    }
  }, [all])

  const move = useCallback(
    async (id: number, dir: -1 | 1) => {
      const open = tasks.filter((t) => !t.done)
      const idx = open.findIndex((t) => t.id === id)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= open.length) return
      const order = [...open]
      ;[order[idx], order[swap]] = [order[swap], order[idx]]
      const before = all
      setAll((prev) => prev.map((t) => {
        const pos = order.findIndex((o) => o.id === t.id)
        return pos >= 0 ? { ...t, position: pos } : t
      }))
      try {
        await api.reorderTasks(order.map((t) => t.id))
      } catch (err) {
        setAll(before)
        throw err
      }
    },
    [all, tasks],
  )

  return { tasks, allTasks: all, loading, refresh, add, toggle, rename, remove, move, currentTaskId, setCurrentTask }
}
