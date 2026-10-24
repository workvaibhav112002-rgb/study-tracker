import React, { useEffect, useRef, useState } from 'react'

interface Props {
  clientId: string
  onCredential: (credential: string) => void
  disabled?: boolean
}

interface GoogleAccounts {
  id: {
    initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; itp_support?: boolean }): void
    renderButton(el: HTMLElement, opts: Record<string, string | number>): void
  }
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Google script failed to load'))
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Renders Google's official button (popup mode; One Tap intentionally off so
 * Safari's tracking protection does not break it). Loads the script only when
 * a client id is configured.
 */
export const GoogleSignInButton: React.FC<Props> = ({ clientId, onCredential, disabled }) => {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    cb.current = onCredential
  })

  useEffect(() => {
    if (!clientId || !ref.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => cb.current(r.credential),
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
        })
        ref.current.innerHTML = ''
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
          logo_alignment: 'left',
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId || failed) return null
  return (
    <div className={`flex justify-center ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div ref={ref} aria-label="Continue with Google" className="min-h-[40px]" />
    </div>
  )
}
