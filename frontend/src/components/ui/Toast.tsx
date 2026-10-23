import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: Kind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let counter = 0

const styles: Record<Kind, { box: string; icon: React.ReactNode }> = {
  success: {
    box: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  },
  error: {
    box: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
  },
  info: {
    box: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    icon: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
  },
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = ++counter
      setToasts((t) => [...t.slice(-3), { id, kind, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  const value = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 w-[min(92vw,400px)] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur shadow-xl text-xs font-medium animate-slide-up ${styles[t.kind].box}`}
          >
            {styles[t.kind].icon}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded hover:bg-white/10 text-current/70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
