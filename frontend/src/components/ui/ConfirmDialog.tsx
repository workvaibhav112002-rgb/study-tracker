import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Field, inputClass } from './Field'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  /** When set, the dialog asks for the user's password and passes it to onConfirm. */
  requirePassword?: boolean
  onConfirm: (password?: string) => Promise<void> | void
  onCancel: () => void
}

/** Replaces window.confirm with an accessible, non-blocking dialog. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  requirePassword = false,
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (isOpen) setPassword('')
  }, [isOpen])

  const confirm = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    try {
      await onConfirm(requirePassword ? password : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : onCancel}
      dismissible={!busy}
      title={title}
      icon={<AlertTriangle className="h-5 w-5" />}
      iconClassName="bg-rose-500/10 text-rose-400 border-rose-500/20"
    >
      <form onSubmit={confirm}>
        <div className="text-sm leading-relaxed text-ink-300">{message}</div>
        {requirePassword && (
          <Field label="Confirm with your password" className="mt-4">
            {(id) => <input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />}
          </Field>
        )}
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={requirePassword && !password}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
