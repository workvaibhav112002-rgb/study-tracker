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

const WIDTHS = { md: 'max-w-md', lg: 'max-w-lg' } as const
const RADII = { '2xl': 'rounded-2xl', '3xl': 'rounded-3xl' } as const

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
  iconClassName = 'bg-white/[0.06] text-brand-400 border-white/[0.08]',
  align = 'left',
  dismissible = true,
  size = 'md',
  rounded = '3xl',
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/70 backdrop-blur-md animate-fade-in"
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
        className={`relative w-full ${WIDTHS[size]} ${RADII[rounded]} border border-white/[0.08] bg-surface-900/95 p-6 sm:p-7 shadow-modal outline-none max-h-[calc(100vh-2rem)] overflow-y-auto animate-scale-in`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />

        {dismissible && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="focus-ring absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-ink-400 transition-colors hover:bg-white/[0.08] hover:text-ink-50"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {align === 'center' ? (
          <div className="mb-6 text-center">
            {icon && (
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${iconClassName}`}>{icon}</div>
            )}
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-ink-50">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1.5 text-sm text-ink-400">
                {description}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-3.5 pr-10">
            {icon && (
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconClassName}`}>{icon}</div>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink-50">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-xs text-ink-400">
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
