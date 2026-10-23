import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  iconClassName?: string
  align?: 'left' | 'center'
  /** When false the dialog has no close button and ignores Escape/backdrop. */
  dismissible?: boolean
  size?: 'md' | 'lg'
  rounded?: '2xl' | '3xl'
  children: React.ReactNode
}

/**
 * Accessible dialog: role/aria wiring, focus trap, focus restore, Escape to
 * close, body scroll lock. Rendered through a portal so it is never clipped.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  iconClassName = 'bg-slate-800 text-brand-400 border-slate-700',
  align = 'left',
  dismissible = true,
  size = 'md',
  rounded = '2xl',
  children,
}) => {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null)

    const first = focusables().find((el) => el.getAttribute('aria-label') !== 'Close dialog') ?? focusables()[0]
    ;(first ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible && onClose) {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen, dismissible, onClose])

  if (!isOpen) return null

  const widths = { md: 'max-w-md', lg: 'max-w-lg' }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible && onClose) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`bg-slate-900 border border-slate-800 rounded-${rounded} w-full ${widths[size]} p-6 shadow-2xl relative outline-none max-h-[calc(100vh-2rem)] overflow-y-auto`}
      >
        {dismissible && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {align === 'center' ? (
          <div className="text-center mb-6">
            {icon && (
              <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 ${iconClassName}`}>{icon}</div>
            )}
            <h2 id={titleId} className="text-xl font-bold text-white tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-xs text-slate-400 mt-1">
                {description}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-3 mb-5 pr-8">
            {icon && (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${iconClassName}`}>{icon}</div>
            )}
            <div>
              <h2 id={titleId} className="text-lg font-bold text-white">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-xs text-slate-400">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>,
    document.body,
  )
}
