import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import type { AuthResponse } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'

interface Props {
  token: string
  onDone: (res: AuthResponse) => void
  onCancel: () => void
}

/** Shown when the app is opened from an emailed /reset link. */
export const ResetPasswordModal: React.FC<Props> = ({ token, onDone, onCancel }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    try {
      onDone(await api.resetPassword(token, password))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen dismissible={!busy} onClose={onCancel} align="center" title="Choose a new password" description="This link works once. Other devices will be signed out." icon={<KeyRound className="h-6 w-6 text-surface-950" aria-hidden="true" />} iconClassName="bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700 shadow-glow-lg">
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          {(id) => <input id={id} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required autoFocus />}
        </Field>
        <Field label="Confirm new password">
          {(id) => <input id={id} type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} required />}
        </Field>
        <Button type="submit" size="xl" loading={busy} className="mt-2 w-full">
          Save password and sign in
        </Button>
      </form>
    </Modal>
  )
}
