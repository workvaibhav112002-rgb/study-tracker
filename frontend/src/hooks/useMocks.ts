import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Mistake, MistakeGrade, MistakeInput, Mock, MockInput, RepeatAlert } from '../types'

/** Mocks, mistakes and repeat alerts for the Mocks tab. Loaded on first use. */
export function useMocks(userId: number | null, active: boolean) {
  const [mocks, setMocks] = useState<Mock[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (userId === null) return
    try {
      const [m, mk] = await Promise.all([api.getMocks(), api.getMistakes()])
      setMocks(m)
      setMistakes(mk)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load mocks.')
    } finally {
      setLoaded(true)
    }
  }, [userId])

  useEffect(() => {
    if (userId === null) {
      setMocks([])
      setMistakes([])
      setLoaded(false)
      return
    }
    if (active && !loaded) void refresh()
  }, [userId, active, loaded, refresh])

  const addMock = useCallback(async (input: MockInput) => {
    const m = await api.createMock(input)
    setMocks((prev) => [m, ...prev].sort((a, b) => b.attempted_on.localeCompare(a.attempted_on) || b.id - a.id))
    return m
  }, [])
  const editMock = useCallback(async (id: number, input: MockInput) => {
    const m = await api.updateMock(id, input)
    setMocks((prev) => prev.map((x) => (x.id === id ? m : x)).sort((a, b) => b.attempted_on.localeCompare(a.attempted_on) || b.id - a.id))
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

  return { mocks, mistakes, loaded, error, refresh, addMock, editMock, removeMock, addMistake, editMistake, removeMistake, gradeMistake }
}

export type MocksState = ReturnType<typeof useMocks>

/** Repeat-error alerts, refreshed when the user changes or `version` bumps. */
export function useRepeatAlerts(userId: number | null, version: number) {
  const [alerts, setAlerts] = useState<RepeatAlert[]>([])
  useEffect(() => {
    if (userId === null) {
      setAlerts([])
      return
    }
    let cancelled = false
    api
      .getRepeatMistakes()
      .then((a) => {
        if (!cancelled) setAlerts(a)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId, version])
  return alerts
}
