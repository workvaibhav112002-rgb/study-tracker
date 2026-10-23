import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, tokenStorage, unauthorizedEvents } from '../api/client'
import type { User } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unreachable'

const RETRY_DELAYS_MS = [5000, 10000, 20000, 30000]

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStorage.get() ? 'loading' : 'anonymous'))
  const retries = useRef(0)

  const bootstrap = useCallback(async () => {
    if (!tokenStorage.get()) {
      setStatus('anonymous')
      return
    }
    setStatus('loading')
    try {
      const me = await api.getMe()
      retries.current = 0
      setUser(me)
      setStatus('authenticated')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        tokenStorage.clear()
        setUser(null)
        setStatus('anonymous')
      } else {
        // Network failure or a server still waking up: keep the token and retry.
        setStatus('unreachable')
      }
    }
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Automatic back-off retry while the server is unreachable.
  useEffect(() => {
    if (status !== 'unreachable') return
    const delay = RETRY_DELAYS_MS[Math.min(retries.current, RETRY_DELAYS_MS.length - 1)]
    retries.current += 1
    const id = setTimeout(() => void bootstrap(), delay)
    return () => clearTimeout(id)
  }, [status, bootstrap])

  // Any 401 on an authenticated call means the session is gone.
  useEffect(
    () =>
      unauthorizedEvents.on(() => {
        tokenStorage.clear()
        setUser(null)
        setStatus('anonymous')
      }),
    [],
  )

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    tokenStorage.set(res.token)
    setUser(res.user)
    setStatus('authenticated')
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.register(email, password, name)
    tokenStorage.set(res.token)
    setUser(res.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
    setStatus('anonymous')
  }, [])

  return { user, status, login, register, logout, retry: bootstrap }
}
