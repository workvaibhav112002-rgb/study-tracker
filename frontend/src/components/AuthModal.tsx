import React, { useState } from 'react'
import { Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react'
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
      rounded="3xl"
      title={mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
      description={
        mode === 'login'
          ? 'Sign in to access your study history and streaks.'
          : 'Track your study sessions, synced to your private account.'
      }
      icon={<ShieldCheck className="w-6 h-6 text-slate-950" aria-hidden="true" />}
      iconClassName="bg-gradient-to-tr from-brand-600 to-emerald-400 shadow-lg shadow-emerald-500/20"
    >
      <div role="tablist" aria-label="Authentication mode" className="flex bg-slate-950 p-1 rounded-xl mb-5 border border-slate-800">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              mode === m ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'login' ? 'Sign In' : 'Register'}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {mode === 'register' && (
          <Field label="Full Name">
            {(id) => (
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" aria-hidden="true" />
                <input
                  id={id}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Smith"
                  autoComplete="name"
                  maxLength={100}
                  className={`${inputClass} pl-10`}
                />
              </div>
            )}
          </Field>
        )}

        <Field label="Email Address">
          {(id) => (
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" aria-hidden="true" />
              <input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className={`${inputClass} pl-10`}
                required
              />
            </div>
          )}
        </Field>

        <Field label="Password" hint={mode === 'register' ? `At least ${MIN_PASSWORD} characters.` : undefined}>
          {(id, describedBy) => (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" aria-hidden="true" />
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

        <Button type="submit" size="lg" loading={loading} className="w-full mt-2 py-3" icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      <p className="text-[11px] text-slate-500 text-center mt-5">Passwords are hashed with bcrypt. Sessions use signed, expiring tokens.</p>
    </Modal>
  )
}
