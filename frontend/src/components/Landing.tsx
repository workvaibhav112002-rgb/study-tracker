import React from 'react'
import { Timer, BarChart3, ListChecks, CalendarDays, Zap, Smartphone, ArrowRight } from 'lucide-react'
import { Button } from './ui/Button'

interface Props {
  onSignIn: () => void
  onRegister: () => void
}

const FEATURES = [
  { icon: Timer, title: 'A timer that never forgets', text: 'Close the laptop, reopen it, the countdown is still right. Synced across your devices.' },
  { icon: Zap, title: 'Honest focus metrics', text: 'Pauses and tab switches are counted, so you see how focused you really were.' },
  { icon: BarChart3, title: 'Insight, not vanity', text: 'Daily goal rings, a year heatmap, your best hours, and a weekly review every Monday.' },
  { icon: ListChecks, title: 'Tasks per session', text: 'Plan what each pomodoro is for, estimate it, tick it off.' },
  { icon: CalendarDays, title: 'Lives in your calendar', text: 'A private feed puts every session into Google or Apple Calendar automatically.' },
  { icon: Smartphone, title: 'Installs anywhere', text: 'Works offline as an app on your phone or desktop. Your data is yours to export.' },
]

/** Logged-out home: what the app does, and two ways in. */
export const Landing: React.FC<Props> = ({ onSignIn, onRegister }) => (
  <div className="mx-auto max-w-5xl px-2 pb-16 pt-10 sm:pt-20">
    <section className="relative text-center">
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full bg-brand-500/20 blur-3xl" />
      <p className="eyebrow mb-4">Pomodoro, projects, analytics</p>
      <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-ink-50 sm:text-6xl">
        Study with intent. <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">See it add up.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base text-ink-400 sm:text-lg">
        A focus timer that survives anything, honest metrics on how you actually work, and a weekly review that tells you what to change.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="xl" onClick={onRegister} icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
          Start for free
        </Button>
        <Button size="xl" variant="secondary" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
      <p className="mt-4 text-xs text-ink-600">No card, no tracking, export anytime.</p>
    </section>

    <section className="stagger mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Features">
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
  </div>
)
