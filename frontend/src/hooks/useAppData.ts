import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client'
import {
  DEFAULT_SETTINGS,
  type DailyStat,
  type DashboardStats,
  type GoalsStats,
  type HourStat,
  type Project,
  type ProjectInput,
  type Session,
  type SessionInput,
  type Settings,
  type WeeklyReview,
} from '../types'

/**
 * Owns all server-backed state for the signed-in user. Mutations resolve on
 * success and reject with the server's message on failure so callers can
 * decide how to surface it.
 */
export function useAppData(userId: number | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [goals, setGoals] = useState<GoalsStats | null>(null)
  const [heatmap, setHeatmap] = useState<DailyStat[]>([])
  const [hours, setHours] = useState<HourStat[]>([])
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (userId === null) return
    setLoading(true)
    try {
      const [p, s, st, se, g, hm, hr, rv] = await Promise.all([
        api.getProjects(),
        api.getSettings(),
        api.getDashboardStats(),
        api.getSessions(),
        api.getGoals(),
        api.getHeatmap(),
        api.getHours(),
        api.getWeeklyReview(),
      ])
      setProjects(p)
      setSettings(s)
      setStats(st)
      setSessions(se)
      setGoals(g)
      setHeatmap(hm)
      setHours(hr)
      setReview(rv)
      setSelectedProjectId((prev) => (prev !== null && p.some((x) => x.id === prev) ? prev : (p[0]?.id ?? null)))
      setError(null)
      setLoaded(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not load your data.'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId === null) {
      setProjects([])
      setSessions([])
      setSettings(DEFAULT_SETTINGS)
      setStats(null)
      setGoals(null)
      setHeatmap([])
      setHours([])
      setReview(null)
      setSelectedProjectId(null)
      setLoaded(false)
      setError(null)
      return
    }
    void reload()
  }, [userId, reload])

  const refreshStats = useCallback(async () => {
    const [st, se, p, g, hm, hr, rv] = await Promise.all([
      api.getDashboardStats(),
      api.getSessions(),
      api.getProjects(),
      api.getGoals(),
      api.getHeatmap(),
      api.getHours(),
      api.getWeeklyReview(),
    ])
    setStats(st)
    setSessions(se)
    setProjects(p)
    setGoals(g)
    setHeatmap(hm)
    setHours(hr)
    setReview(rv)
  }, [])

  const createProject = useCallback(
    async (input: ProjectInput) => {
      const created = await api.createProject(input)
      setProjects((prev) => [...prev, created])
      setSelectedProjectId((prev) => prev ?? created.id)
    },
    [],
  )

  const updateProject = useCallback(async (id: number, input: ProjectInput) => {
    const updated = await api.updateProject(id, input)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)))
  }, [])

  const deleteProject = useCallback(
    async (id: number) => {
      await api.deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      setSelectedProjectId((prev) => (prev === id ? null : prev))
      await refreshStats()
    },
    [refreshStats],
  )

  // Keep the selected project valid as the list changes.
  useEffect(() => {
    if (selectedProjectId === null && projects.length > 0) setSelectedProjectId(projects[0].id)
  }, [projects, selectedProjectId])

  const createSession = useCallback(
    async (input: SessionInput) => {
      await api.createSession(input)
      await refreshStats()
    },
    [refreshStats],
  )

  const deleteSession = useCallback(
    async (id: number) => {
      await api.deleteSession(id)
      await refreshStats()
    },
    [refreshStats],
  )

  const updateSettings = useCallback(async (next: Settings) => {
    const saved = await api.updateSettings(next)
    setSettings(saved)
  }, [])

  return {
    projects,
    sessions,
    settings,
    stats,
    goals,
    heatmap,
    hours,
    review,
    refreshStats,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    loaded,
    error,
    reload,
    createProject,
    updateProject,
    deleteProject,
    createSession,
    deleteSession,
    updateSettings,
  }
}
