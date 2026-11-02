import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { JournalConfig, Mistake, MistakeGrade, MistakeInput, Mock, MockInput, PatternAlert } from '../types'

const byDate = (a: Mock, b: Mock) => b.attempted_on.localeCompare(a.attempted_on) || b.id - a.id

/** Mistakes, tests and the user's journal setup. Loaded on first use. */
export function useJournal(userId: number | null, active: boolean) {
  const [mocks, setMocks] = useState<Mock[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [userConfig, setUserConfig] = useState<JournalConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (userId === null) return
    try {
      const [m, mk, j] = await Promise.all([api.getMocks(), api.getMistakes(), api.getJournal()])
      setMocks(m)
      setMistakes(mk)
      setUserConfig(j.config)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your mistakes.')
    } finally {
      setLoaded(true)
    }
  }, [userId])

  useEffect(() => {
    if (userId === null) {
      setMocks([])
      setMistakes([])
      setUserConfig(null)
      setLoaded(false)
      return
    }
    if (active && !loaded) void refresh()
  }, [userId, active, loaded, refresh])

  const addMock = useCallback(async (input: MockInput) => {
    const m = await api.createMock(input)
    setMocks((prev) => [m, ...prev].sort(byDate))
    return m
  }, [])
  const editMock = useCallback(async (id: number, input: MockInput) => {
    const m = await api.updateMock(id, input)
    setMocks((prev) => prev.map((x) => (x.id === id ? m : x)).sort(byDate))
    return m
  }, [])
  const removeMock = useCallback(async (id: number) => {
    await api.deleteMock(id)
    setMocks((prev) => prev.filter((x) => x.id !== id))
    setMistakes((prev) => prev.map((x) => (x.mock_id === id ? { ...x, mock_id: null } : x)))
  }, [])

  const addMistake = useCallback(async (input: MistakeInput) => {
    const m = await api.createMistake(input)
    setMistakes((prev) => [m, ...prev])
    return m
  }, [])
  const editMistake = useCallback(async (id: number, input: MistakeInput) => {
    const m = await api.updateMistake(id, input)
    setMistakes((prev) => prev.map((x) => (x.id === id ? m : x)))
    return m
  }, [])
  const removeMistake = useCallback(async (id: number) => {
    await api.deleteMistake(id)
    setMistakes((prev) => prev.filter((x) => x.id !== id))
  }, [])
  const gradeMistake = useCallback(async (id: number, grade: MistakeGrade) => {
    const m = await api.gradeMistake(id, grade)
    setMistakes((prev) => prev.map((x) => (x.id === id ? m : x)))
    return m
  }, [])
  const saveUserConfig = useCallback(async (c: JournalConfig | null) => {
    const res = await api.putJournal(c)
    setUserConfig(res.config)
  }, [])
  const retag = useCallback(
    async (data: { project_id?: number; category: string; from: string; to: string }) => {
      await api.retagMistakes(data)
      setMistakes(await api.getMistakes())
    },
    [],
  )

  return { mocks, mistakes, userConfig, loaded, error, refresh, addMock, editMock, removeMock, addMistake, editMistake, removeMistake, gradeMistake, saveUserConfig, retag }
}

export type JournalState = ReturnType<typeof useJournal>

/** Repeating patterns across all projects (and the user's default setup to
 * label them), for the Focus-tab banner. */
export function usePatternAlerts(userId: number | null, version: number) {
  const [alerts, setAlerts] = useState<PatternAlert[]>([])
  const [userConfig, setUserConfig] = useState<JournalConfig | null>(null)
  useEffect(() => {
    if (userId === null) {
      setAlerts([])
      setUserConfig(null)
      return
    }
    let cancelled = false
    Promise.all([api.getMistakePatterns(), api.getJournal()])
      .then(([a, j]) => {
        if (cancelled) return
        setAlerts(a)
        setUserConfig(j.config)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId, version])
  return { alerts, userConfig }
}
