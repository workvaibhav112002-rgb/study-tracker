import React from 'react'
import { Timer, BarChart3, Target, CalendarDays, Zap, Smartphone } from 'lucide-react'

const FEATURES = [
  { icon: Timer, title: 'A timer that never forgets', text: 'Close the laptop, reopen it, the countdown is still right. Plan tasks for each session, synced across devices.' },
  { icon: Zap, title: 'The texture of your focus', text: 'Pauses and tab switches are counted, so you see how focused you really were, not just how long you sat there.' },
  { icon: Target, title: 'Mistake Lab', text: 'Log a slip in seconds with your own categories. It finds the ones you keep repeating and what to review first.' },
  { icon: BarChart3, title: 'Insight, not vanity', text: 'Your best hours, a year heatmap and a weekly review every Monday. Flashcards are there as an add-on if you need them.' },
  { icon: CalendarDays, title: 'Lives in your calendar', text: 'A private feed puts every session into Google or Apple Calendar automatically.' },
  { icon: Smartphone, title: 'Installs anywhere', text: 'Works offline as an app on your phone or desktop. Your data is yours to export.' },
]

export const Features: React.FC = () => (
  <section className="stagger mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Features">
    {FEATURES.map((f) => {
      const Icon = f.icon
      return (
        <div key={f.title} className="card card-hover p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-ink-50">{f.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{f.text}</p>
        </div>
      )
    })}
  </section>
)
