import React, { useState } from 'react'
import { Lock, Mail, User as UserIcon, ArrowRight } from 'lucide-react'
import { errorMessage } from '../api/client'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'

interface AuthModalProps {
  isOpen: boolean
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, name: string) => Promise<void>
}

const MIN_PASSWORD = 8

const Mark: React.FC = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7 text-surface-950" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

/** Sign-in gate. Not dismissible: the app needs an account to store data. */
export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onLogin, onRegister }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'register' && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    setLoading(true)
    try {
      if (mode === 'register') await onRegister(email.trim(), password, name.trim())
      else await onLogin(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err, 'Authentication failed. Please check your credentials.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      dismissible={false}
      align="center"
      title={mode === 'login' ? 'Welcome back' : 'Create your account'}
      description={mode === 'login' ? 'Sign in to pick up your streak where you left it.' : 'Your sessions, projects and stats, synced privately.'}
      icon={<Mark />}
      iconClassName="bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700 shadow-glow-lg"
    >
      <div role="tablist" aria-label="Authentication mode" className="mb-6 flex rounded-xl border border-white/[0.06] bg-surface-950/60 p-1">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`focus-ring flex-1 rounded-lg py-2 text-[13px] font-medium transition-all duration-200 ease-premium ${
              mode === m ? 'bg-white/[0.08] text-ink-50 shadow-inner-hi' : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            {m === 'login' ? 'Sign in' : 'Register'}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <Field label="Name">
            {(id) => (
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Smith" autoComplete="name" maxLength={100} className={`${inputClass} pl-10`} />
              </div>
            )}
          </Field>
        )}

        <Field label="Email">
          {(id) => (
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={`${inputClass} pl-10`} required />
            </div>
          )}
        </Field>

        <Field label="Password" hint={mode === 'register' ? `At least ${MIN_PASSWORD} characters.` : undefined}>
          {(id, describedBy) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              <input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={mode === 'register' ? MIN_PASSWORD : 1}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                aria-describedby={describedBy}
                className={`${inputClass} pl-10`}
                required
              />
            </div>
          )}
        </Field>

        <Button type="submit" size="xl" loading={loading} className="mt-2 w-full" icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-[11px] text-ink-600">Passwords are hashed with bcrypt. Sessions use signed, expiring tokens.</p>
    </Modal>
  )
}
