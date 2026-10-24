import React, { useState } from 'react'
import { Lock, Mail, User as UserIcon, ArrowRight, Wand2, ArrowLeft, Inbox } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import type { AppConfig } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'
import { GoogleSignInButton } from './GoogleSignInButton'

interface AuthModalProps {
  isOpen: boolean
  config: AppConfig
  initialView?: 'login' | 'register'
  onClose?: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, name: string) => Promise<void>
  onGoogle: (credential: string) => Promise<void>
}

type View = 'login' | 'register' | 'forgot' | 'magic' | 'sent'
const MIN_PASSWORD = 8

const Mark: React.FC = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7 text-surface-950" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

const COPY: Record<View, { title: string; description: string }> = {
  login: { title: 'Welcome back', description: 'Sign in to pick up your streak where you left it.' },
  register: { title: 'Create your account', description: 'Your sessions, projects and stats, synced privately.' },
  forgot: { title: 'Reset your password', description: 'We will email you a link that works for one hour.' },
  magic: { title: 'Sign in by email', description: 'No password needed. We will send a one-time link.' },
  sent: { title: 'Check your inbox', description: 'If that address is right, a link is on its way. It may take a minute.' },
}

/** Sign-in dialog, opened from the landing page or an emailed link. */
export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, config, initialView = 'login', onClose, onLogin, onRegister, onGoogle }) => {
  const [view, setView] = useState<View>(initialView)
  const [openedWith, setOpenedWith] = useState(initialView)
  if (isOpen && openedWith !== initialView) {
    setOpenedWith(initialView)
    setView(initialView)
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const go = (v: View) => {
    setView(v)
    setError(null)
  }

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError(null)
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err, fallback))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const addr = email.trim()
    if (view === 'register' && password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (view === 'login') return run(() => onLogin(addr, password), 'Authentication failed. Please check your credentials.')
    if (view === 'register') return run(() => onRegister(addr, password, name.trim()), 'Could not create the account.')
    if (view === 'forgot') return run(async () => { await api.forgotPassword(addr); setView('sent') }, 'Could not send the email.')
    if (view === 'magic') return run(async () => { await api.requestMagicLink(addr); setView('sent') }, 'Could not send the email.')
  }

  const copy = COPY[view]
  const emailField = (
    <Field label="Email">
      {(id) => (
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={`${inputClass} pl-10`} required />
        </div>
      )}
    </Field>
  )

  return (
    <Modal isOpen={isOpen} dismissible={Boolean(onClose) && !loading} onClose={onClose} align="center" title={copy.title} description={copy.description} icon={view === 'sent' ? <Inbox className="h-6 w-6 text-surface-950" aria-hidden="true" /> : <Mark />} iconClassName="bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700 shadow-glow-lg">
      {(view === 'login' || view === 'register') && (
        <div role="tablist" aria-label="Authentication mode" className="mb-6 flex rounded-xl border border-fg/[0.06] bg-surface-950/60 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={view === m} onClick={() => go(m)} className={`focus-ring flex-1 rounded-lg py-2 text-[13px] font-medium transition-all duration-200 ease-premium ${view === m ? 'bg-fg/[0.08] text-ink-50 shadow-inner-hi' : 'text-ink-400 hover:text-ink-100'}`}>
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {view === 'sent' ? (
        <div className="space-y-4 text-center">
          <p className="text-xs text-ink-500">Sent to {email.trim()}. Check spam if it does not arrive.</p>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => go('login')} icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'register' && (
            <Field label="Name">
              {(id) => (
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                  <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Smith" autoComplete="name" maxLength={100} className={`${inputClass} pl-10`} />
                </div>
              )}
            </Field>
          )}

          {emailField}

          {(view === 'login' || view === 'register') && (
            <Field label="Password" hint={view === 'register' ? `At least ${MIN_PASSWORD} characters.` : undefined}>
              {(id, describedBy) => (
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                  <input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={view === 'register' ? MIN_PASSWORD : 1} autoComplete={view === 'register' ? 'new-password' : 'current-password'} aria-describedby={describedBy} className={`${inputClass} pl-10`} required />
                </div>
              )}
            </Field>
          )}

          {view === 'login' && config.email_enabled && (
            <div className="-mt-1 text-right">
              <button type="button" onClick={() => go('forgot')} className="focus-ring rounded text-xs font-medium text-ink-400 hover:text-brand-300">
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" size="xl" loading={loading} className="mt-2 w-full" icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
            {loading ? 'Please wait…' : view === 'login' ? 'Sign in' : view === 'register' ? 'Create account' : view === 'forgot' ? 'Email me a reset link' : 'Email me a sign-in link'}
          </Button>

          {(view === 'forgot' || view === 'magic') && (
            <button type="button" onClick={() => go('login')} className="focus-ring mx-auto flex items-center gap-1.5 rounded text-xs font-medium text-ink-400 hover:text-ink-100">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
            </button>
          )}
        </form>
      )}

      {(view === 'login' || view === 'register') && (config.google_client_id || config.email_enabled) && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-ink-600" aria-hidden="true">
            <span className="h-px flex-1 bg-fg/[0.06]" />
            or
            <span className="h-px flex-1 bg-fg/[0.06]" />
          </div>
          <GoogleSignInButton clientId={config.google_client_id} disabled={loading} onCredential={(cred) => void run(() => onGoogle(cred), 'Google sign-in failed.')} />
          {config.email_enabled && (
            <Button variant="secondary" size="lg" className="w-full" onClick={() => go('magic')} icon={<Wand2 className="h-4 w-4 text-brand-400" aria-hidden="true" />}>
              Email me a sign-in link
            </Button>
          )}
        </div>
      )}

      <p className="mt-5 text-center text-[11px] text-ink-600">Passwords are hashed with bcrypt. Sessions use signed, expiring tokens.</p>
    </Modal>
  )
}
