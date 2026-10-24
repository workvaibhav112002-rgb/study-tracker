import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Note, NoteInput } from '../types'

export function useNotes(userId: number | null) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (userId === null) return
    setLoading(true)
    try {
      setNotes(await api.getNotes())
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId === null) {
      setNotes([])
      return
    }
    void refresh().catch(() => undefined)
  }, [userId, refresh])

  const add = useCallback(async (input: NoteInput) => {
    const n = await api.createNote(input)
    setNotes((prev) => [n, ...prev])
    return n
  }, [])
  const edit = useCallback(async (id: number, input: NoteInput) => {
    const n = await api.updateNote(id, input)
    setNotes((prev) => prev.map((x) => (x.id === id ? n : x)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at ?? '').localeCompare(a.updated_at ?? '')))
    return n
  }, [])
  const remove = useCallback(async (id: number) => {
    await api.deleteNote(id)
    setNotes((prev) => prev.filter((x) => x.id !== id))
  }, [])

  return { notes, loading, refresh, add, edit, remove }
}
