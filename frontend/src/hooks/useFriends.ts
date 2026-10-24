import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Friend } from '../types'

const POLL_MS = 30_000

/**
 * Friends with live presence. Polls while the tab is visible and the
 * panel is mounted; polling is cheap (one query) and avoids websockets,
 * which the free hosting tier cannot keep open.
 */
export function useFriends(userId: number | null, active: boolean) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (userId === null || inFlight.current) return
    inFlight.current = true
    try {
      setFriends(await api.getFriends())
      setError(null)
      setLoaded(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not load friends.'))
    } finally {
      inFlight.current = false
    }
  }, [userId])

  useEffect(() => {
    if (userId === null) {
      setFriends([])
      setLoaded(false)
      setError(null)
      return
    }
    void refresh()
  }, [userId, refresh])

  useEffect(() => {
    if (!active || userId === null) return
    void refresh()
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active, userId, refresh])

  const invite = useCallback(() => api.createFriendInvite(), [])

  const accept = useCallback(async (token: string) => {
    const res = await api.acceptFriendInvite(token)
    setFriends(res.friends)
    setLoaded(true)
    return res.friend
  }, [])

  const remove = useCallback(async (id: number) => {
    await api.removeFriend(id)
    setFriends((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return { friends, loaded, error, refresh, invite, accept, remove }
}
