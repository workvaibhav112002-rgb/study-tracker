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
  { id: 'general', label: 'Thought', icon: MessageCircle, color: 'text-sky-400' },
  { id: 'feature', label: 'Feature Idea', icon: Lightbulb, color: 'text-yellow-400' },
  { id: 'bug', label: 'Bug Report', icon: Bug, color: 'text-rose-400' },
  { id: 'praise', label: 'Love it!', icon: Heart, color: 'text-pink-400' },
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
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } })
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
      rounded="3xl"
      title={submitted ? 'Thank You for Your Feedback!' : 'Share Your Feedback'}
      description={submitted ? undefined : 'Have a suggestion or found a bug? Let us know!'}
      icon={submitted ? <CheckCircle2 className="w-5 h-5" /> : <MessageSquarePlus className="w-5 h-5" />}
      iconClassName={submitted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-brand-500/10 text-brand-400 border-brand-500/20'}
    >
      {submitted ? (
        <div className="text-center pb-2">
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
            Your feedback was delivered to the creator. It helps shape upcoming features and improvements!
          </p>
          <Button onClick={onClose}>Back to Study Tracker</Button>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-2">What kind of feedback is this?</span>
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
                      className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        selected ? 'bg-slate-800 text-white border-brand-500 shadow-sm' : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${t.color}`} aria-hidden="true" />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Field label="Your Message">
              {(id) => (
                <textarea
                  id={id}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you like, what feels confusing, or what feature you'd love to see..."
                  rows={4}
                  maxLength={2000}
                  className={`${inputClass} resize-none`}
                  required
                />
              )}
            </Field>

            <Field
              label={
                <>
                  Your Email <span className="text-slate-500 font-normal">(optional, for replies)</span>
                </>
              }
            >
              {(id) => (
                <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={inputClass} />
              )}
            </Field>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} icon={<Send className="w-3.5 h-3.5" aria-hidden="true" />}>
                {loading ? 'Submitting…' : 'Send Feedback'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  )
}
