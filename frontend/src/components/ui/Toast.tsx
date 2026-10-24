import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: Kind
  message: string
  action?: { label: string; run: () => void }
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  /** Persistent toast with a button; stays until clicked or dismissed. */
  action: (message: string, label: string, run: () => void) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let counter = 0

const styles: Record<Kind, { bar: string; icon: React.ReactNode }> = {
  success: { bar: 'bg-brand-400', icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-400" /> },
  error: { bar: 'bg-rose-400', icon: <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" /> },
  info: { bar: 'bg-accent-sky', icon: <Info className="h-4 w-4 shrink-0 text-accent-sky" /> },
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: Kind, message: string, action?: Toast['action']) => {
      const id = ++counter
      setToasts((t) => [...t.slice(-3), { id, kind, message, action }])
      if (!action) window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  const value = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      action: (m, label, run) => push('info', m, { label, run }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex w-[min(92vw,400px)] -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="glass pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl py-3 pl-4 pr-3 text-[13px] font-medium text-ink-100 shadow-modal animate-slide-up"
          >
            <span aria-hidden="true" className={`absolute left-0 top-0 h-full w-0.5 ${styles[t.kind].bar}`} />
            {styles[t.kind].icon}
            <span className="flex-1 leading-snug">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.run()
                  dismiss(t.id)
                }}
                className="focus-ring rounded-lg border border-fg/[0.1] bg-fg/[0.08] px-2.5 py-1 text-xs font-semibold text-ink-50 hover:bg-fg/[0.14]"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="focus-ring rounded-md p-1 text-ink-500 opacity-80 transition hover:bg-fg/10 hover:text-ink-100 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
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
