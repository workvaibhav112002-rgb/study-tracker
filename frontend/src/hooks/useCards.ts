import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Card, CardInput, CardRating, CardStats } from '../types'

const EMPTY: CardStats = { total: 0, due: 0, new: 0, mastered: 0, reviewed_last_7_days: 0 }

export function useCards(userId: number | null, projectId: number | null) {
  const [cards, setCards] = useState<Card[]>([])
  const [stats, setStats] = useState<CardStats>(EMPTY)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (userId === null) return
    setLoading(true)
    try {
      const [c, st] = await Promise.all([api.getCards({ projectId: projectId ?? undefined }), api.getCardStats(projectId ?? undefined)])
      setCards(c)
      setStats(st)
    } finally {
      setLoading(false)
    }
  }, [userId, projectId])

  useEffect(() => {
    if (userId === null) {
      setCards([])
      setStats(EMPTY)
      return
    }
    void refresh().catch(() => undefined)
  }, [userId, refresh])

  const add = useCallback(async (input: CardInput) => {
    const c = await api.createCard(input)
    setCards((prev) => [c, ...prev])
    setStats((s) => ({ ...s, total: s.total + 1, due: s.due + 1, new: s.new + 1 }))
  }, [])

  const edit = useCallback(async (id: number, input: Omit<CardInput, 'project_id'>) => {
    const c = await api.updateCard(id, input)
    setCards((prev) => prev.map((x) => (x.id === id ? c : x)))
  }, [])

  const remove = useCallback(async (id: number) => {
    await api.deleteCard(id)
    setCards((prev) => prev.filter((x) => x.id !== id))
    await refresh()
  }, [refresh])

  const archive = useCallback(async (id: number, archived: boolean) => {
    await api.archiveCard(id, archived)
    await refresh()
  }, [refresh])

  const review = useCallback(async (id: number, rating: CardRating) => {
    const c = await api.reviewCard(id, rating)
    setCards((prev) => prev.map((x) => (x.id === id ? c : x)))
    return c
  }, [])

  return { cards, stats, loading, refresh, add, edit, remove, archive, review }
}
