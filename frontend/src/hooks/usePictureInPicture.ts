import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPip, supportsPip, type PipFrame } from '../lib/pip'

/** Keeps a floating always-on-top timer in sync with the main one. */
export function usePictureInPicture(frame: PipFrame) {
  const pip = useMemo(() => createPip(), [])
  const [active, setActive] = useState(false)
  const supported = useMemo(() => supportsPip(), [])
  const latest = useRef(frame)
  latest.current = frame

  useEffect(() => {
    pip.onClose(() => setActive(false))
  }, [pip])

  useEffect(() => {
    pip.update(frame)
  }, [pip, frame])

  useEffect(() => () => void pip.close(), [pip])

  const toggle = useCallback(async () => {
    if (pip.isOpen()) {
      await pip.close()
      setActive(false)
      return
    }
    setActive(await pip.open(latest.current))
  }, [pip])

  return { supported, active, toggle }
}
