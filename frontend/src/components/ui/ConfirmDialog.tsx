import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

/** Replaces window.confirm with an accessible, non-blocking dialog. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
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
      <div className="text-sm leading-relaxed text-ink-300">{message}</div>
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
