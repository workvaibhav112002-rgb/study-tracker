import { useCallback, useEffect, useState } from 'react'

/** Distraction-free fullscreen. Exits when the browser leaves fullscreen (Escape). */
export function useZenMode(): { zen: boolean; toggle: () => void; exit: () => void } {
  const [zen, setZen] = useState(false)

  const enter = useCallback(async () => {
    setZen(true)
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    } catch {
      /* fullscreen denied: zen still hides the chrome */
    }
  }, [])

  const exit = useCallback(() => {
    setZen(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [])

  const toggle = useCallback(() => {
    if (zen) exit()
    else void enter()
  }, [zen, enter, exit])

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setZen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  return { zen, toggle, exit }
}
