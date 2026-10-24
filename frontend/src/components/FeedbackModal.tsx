import React, { useEffect, useState } from 'react'
import { MessageSquarePlus, Send, CheckCircle2, Heart, Bug, Lightbulb, MessageCircle } from 'lucide-react'
import confetti from 'canvas-confetti'
import { api, errorMessage } from '../api/client'
import type { FeedbackType } from '../types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Field'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
}

const TYPES: { id: FeedbackType; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'general', label: 'Thought', icon: MessageCircle, color: 'text-accent-sky' },
  { id: 'feature', label: 'Feature idea', icon: Lightbulb, color: 'text-accent-amber' },
  { id: 'bug', label: 'Bug report', icon: Bug, color: 'text-rose-400' },
  { id: 'praise', label: 'Love it', icon: Heart, color: 'text-pink-400' },
]

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, userEmail }) => {
  const [type, setType] = useState<FeedbackType>('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setEmail(userEmail ?? '')
      setSubmitted(false)
      setError(null)
    }
  }, [isOpen, userEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.submitFeedback({ type, message: message.trim(), email: email.trim() || undefined })
      setSubmitted(true)
      setMessage('')
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ['#34d399', '#4cc2f5', '#f5b63d'] })
    } catch (err) {
      setError(errorMessage(err, 'Failed to send feedback. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={submitted ? 'Thank you' : 'Share feedback'}
      description={submitted ? 'Your note went straight to the creator.' : 'Ideas, bugs or just a hello.'}
      icon={submitted ? <CheckCircle2 className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
      iconClassName={submitted ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' : 'bg-fg/[0.06] text-brand-400 border-fg/[0.08]'}
    >
      {submitted ? (
        <div className="flex justify-end">
          <Button onClick={onClose}>Back to studying</Button>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-300">What is it about?</span>
              <div role="radiogroup" aria-label="Feedback type" className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => {
                  const Icon = t.icon
                  const selected = type === t.id
                  return (
                    <button
                      type="button"
                      key={t.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(t.id)}
                      className={`focus-ring flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ease-premium ${
                        selected ? 'border-brand-500/40 bg-brand-500/10 text-ink-50 shadow-inner-hi' : 'border-fg/[0.06] bg-fg/[0.03] text-ink-400 hover:bg-fg/[0.06] hover:text-ink-100'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${t.color}`} aria-hidden="true" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Field label="Message">
              {(id) => (
                <textarea id={id} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what you like, what feels off, or what you'd love to see." rows={4} maxLength={2000} className={`${inputClass} resize-none`} required />
              )}
            </Field>

            <Field label={<>Email <span className="font-normal text-ink-500">(optional, for replies)</span></>}>
              {(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={inputClass} />}
            </Field>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}>
                {loading ? 'Sending…' : 'Send feedback'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  )
}
