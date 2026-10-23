import React, { useState } from 'react'
import { Star, Check, X, BookOpen, Clock } from 'lucide-react'
import { Project } from '../types'

interface SessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (rating: number, notes: string) => void
  durationSeconds: number
  project: Project | undefined
}

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  durationSeconds,
  project,
}) => {
  const [rating, setRating] = useState<number>(5)
  const [notes, setNotes] = useState<string>('')
  const [hoverRating, setHoverRating] = useState<number>(0)

  if (!isOpen) return null

  const minutes = Math.round(durationSeconds / 60)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(rating, notes.trim())
    setNotes('')
    setRating(5)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pomodoro Completed!</h3>
            <p className="text-xs text-slate-400">Great focus block. Log your progress below.</p>
          </div>
        </div>

        {/* Session Snapshot Card */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 mb-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project?.color || '#3b82f6' }}
            />
            <span className="text-sm font-semibold text-slate-200">
              {project?.name || 'General Study'}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <Clock className="w-3.5 h-3.5" />
            <span>{minutes} minutes</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Focus Rating */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              How focused were you? (1-5)
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating || rating) >= star
                return (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1.5 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                )
              })}
              <span className="text-xs text-slate-400 ml-2 font-medium">
                {rating === 5
                  ? '🌟 Peak Focus'
                  : rating === 4
                  ? '⚡ High Focus'
                  : rating === 3
                  ? '👌 Decent'
                  : rating === 2
                  ? '💭 Distracted'
                  : '😴 Low Energy'}
              </span>
            </div>
          </div>

          {/* Session Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Study Notes / What did you accomplish?
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Read chapters 3-4, wrote unit tests for Go SQLite repository..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Skip Logging
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-xs font-bold shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
            >
              Save Study Session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
