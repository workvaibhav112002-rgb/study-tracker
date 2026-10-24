import { useEffect, useRef } from 'react'

interface Handlers {
  onNeedRefresh: (reload: () => void) => void
  onOfflineReady: () => void
}

/** Registers the PWA service worker in production builds only. */
export function useServiceWorker({ onNeedRefresh, onOfflineReady }: Handlers): void {
  const handlers = useRef({ onNeedRefresh, onOfflineReady })
  useEffect(() => {
    handlers.current = { onNeedRefresh, onOfflineReady }
  })
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let cancelled = false
    void import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        const update = registerSW({
          immediate: true,
          onNeedRefresh: () => handlers.current.onNeedRefresh(() => void update(true)),
          onOfflineReady: () => handlers.current.onOfflineReady(),
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
}

/** Drops cached API responses so the next user never sees the previous one's data. */
export async function clearApiCache(): Promise<void> {
  try {
    if ('caches' in window) await caches.delete('api-get')
  } catch {
    /* ignore */
  }
}
