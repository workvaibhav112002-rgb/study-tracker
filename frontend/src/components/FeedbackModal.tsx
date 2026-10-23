import React, { useState } from 'react'
import { X, MessageSquarePlus, Send, Sparkles, CheckCircle2, Heart, Bug, Lightbulb, MessageCircle } from 'lucide-react'
import { api } from '../api/client'
import confetti from 'canvas-confetti'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, userEmail }) => {
  const [type, setType] = useState<'feature' | 'bug' | 'praise' | 'general'>('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(userEmail || '')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setLoading(true)
    setError(null)

    try {
      await api.submitFeedback({
        type,
        message: message.trim(),
        email: email.trim(),
      })
      setSubmitted(true)
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 },
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to send feedback. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetAndClose = () => {
    setSubmitted(false)
    setMessage('')
    setError(null)
    onClose()
  }

  const feedbackTypes = [
    { id: 'general', label: 'Thought', icon: MessageCircle, color: 'text-sky-400' },
    { id: 'feature', label: 'Feature Idea', icon: Lightbulb, color: 'text-yellow-400' },
    { id: 'bug', label: 'Bug Report', icon: Bug, color: 'text-rose-400' },
    { id: 'praise', label: 'Love it!', icon: Heart, color: 'text-pink-400' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Thank You for Your Feedback!</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
              Your feedback was delivered directly to the creator. It helps shape upcoming features and improvements!
            </p>
            <button
              onClick={handleResetAndClose}
              className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-brand-500/20"
            >
              Back to Study Tracker
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
                <MessageSquarePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Share Your Feedback</h3>
                <p className="text-xs text-slate-400">Have a suggestion or found a bug? Let us know!</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  What kind of feedback is this?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {feedbackTypes.map((t) => {
                    const Icon = t.icon
                    const isSelected = type === t.id
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                          isSelected
                            ? 'bg-slate-800 text-white border-brand-500 shadow-sm'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                        <span>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you like, what feels confusing, or what feature you'd love to see..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  required
                />
              </div>

              {/* Optional Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Your Email <span className="text-slate-500 font-normal">(optional, for replies)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Submitting...' : 'Send Feedback'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
