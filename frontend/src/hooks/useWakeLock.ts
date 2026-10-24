import { useEffect, useRef, useState } from 'react'

interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

/** Keeps the screen awake while `active`, where the Screen Wake Lock API exists. */
export function useWakeLock(active: boolean): { held: boolean } {
  const [held, setHeld] = useState(false)
  const sentinel = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock
    if (!active || !wakeLock) return

    let cancelled = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel.current) return
      try {
        const s = await wakeLock.request('screen')
        if (cancelled) {
          void s.release()
          return
        }
        sentinel.current = s
        setHeld(true)
        s.addEventListener('release', () => {
          sentinel.current = null
          setHeld(false)
        })
      } catch {
        /* denied or unsupported */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      const s = sentinel.current
      sentinel.current = null
      if (s) void s.release().catch(() => undefined)
      setHeld(false)
    }
  }, [active])

  return { held }
}
