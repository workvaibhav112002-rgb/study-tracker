import React, { useState } from 'react'
import { KeyRound, UserX } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import type { AuthResponse } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Field, inputClass } from '../ui/Field'
import { useToast } from '../ui/Toast'

interface Props {
  email: string
  onPasswordChanged: (res: AuthResponse) => void
  onDeleted: () => void
}

export const AccountSection: React.FC<Props> = ({ email, onPasswordChanged, onDeleted }) => {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const change = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')
    setBusy(true)
    try {
      const res = await api.changePassword(current, next)
      onPasswordChanged(res)
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Password changed. Other devices have been signed out.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="account-section" className="space-y-4">
      <div>
        <h3 id="account-section" className="eyebrow">
          Account
        </h3>
        <p className="mt-1 text-xs text-ink-500">Signed in as {email}.</p>
      </div>
      <form onSubmit={change} className="space-y-3">
        <Field label="Current password">
          {(id) => <input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} required />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New password">
            {(id) => <input id={id} type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} required />}
          </Field>
          <Field label="Confirm new password">
            {(id) => <input id={id} type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} required />}
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {error}
          </p>
        )}
        <Button type="submit" size="sm" variant="secondary" loading={busy} icon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}>
          Change password
        </Button>
      </form>

      <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-3">
        <p className="text-xs text-ink-400">Deleting your account removes every project, session and task permanently.</p>
        <Button size="sm" variant="ghost" className="mt-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300" onClick={() => setConfirmDelete(true)} icon={<UserX className="h-3.5 w-3.5" aria-hidden="true" />}>
          Delete account
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete your account?"
        message="This cannot be undone. Export a backup first if you want to keep your history."
        confirmLabel="Delete account"
        requirePassword
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async (password) => {
          try {
            await api.deleteAccount(password ?? '')
            setConfirmDelete(false)
            onDeleted()
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </section>
  )
}
