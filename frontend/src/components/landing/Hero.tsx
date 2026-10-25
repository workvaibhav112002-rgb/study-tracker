import React, { useEffect, useRef } from 'react'
import { ArrowRight, ShieldCheck, Download, WifiOff } from 'lucide-react'
import type { DemoSession } from '../../lib/demoTimer'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Button } from '../ui/Button'
import { DemoTimer } from './DemoTimer'
import { FloatingCards } from './FloatingCards'

interface Props {
  onSignIn: () => void
  onRegister: () => void
  onDemoFinished: (session: DemoSession, intent: 'register' | 'login') => void
}

const PROMISES = [
  { icon: ShieldCheck, text: 'No card, no tracking' },
  { icon: Download, text: 'Export anytime' },
  { icon: WifiOff, text: 'Works offline' },
]

/** Bold headline, drifting glow, and a timer you can start before signing up. */
export const Hero: React.FC<Props> = ({ onSignIn, onRegister, onDemoFinished }) => {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  // Pointer parallax: one listener, throttled to a frame, writes CSS variables.
  useEffect(() => {
    const el = ref.current
    if (!el || reduced || !window.matchMedia('(hover: hover)').matches) return
    let frame = 0
    let nx = 0
    let ny = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      nx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ny = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!frame) {
        frame = requestAnimationFrame(() => {
          el.style.setProperty('--px', nx.toFixed(3))
          el.style.setProperty('--py', ny.toFixed(3))
          frame = 0
        })
      }
    }
    const onLeave = () => {
      el.style.setProperty('--px', '0')
      el.style.setProperty('--py', '0')
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [reduced])

  return (
    <section ref={ref} className="parallax relative overflow-visible pt-6 sm:pt-12" aria-label="Introduction">
      {/* Drifting glow blobs */}
      <span aria-hidden="true" className="parallax-layer pointer-events-none absolute -left-24 top-0 -z-10 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl animate-blob" style={{ '--depth': '-24px' } as React.CSSProperties} />
      <span aria-hidden="true" className="parallax-layer pointer-events-none absolute -right-16 top-40 -z-10 h-96 w-96 rounded-full blur-3xl animate-blob" style={{ background: 'rgb(var(--glow-2) / 0.22)', animationDelay: '-6s', '--depth': '-40px' } as React.CSSProperties} />
      <span aria-hidden="true" className="parallax-layer pointer-events-none absolute left-1/3 top-[28rem] -z-10 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl animate-blob" style={{ animationDelay: '-12s', '--depth': '-12px' } as React.CSSProperties} />

      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <p className="eyebrow mb-4 animate-fade-up">Pomodoro, projects, analytics</p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight text-ink-50 animate-fade-up sm:text-7xl" style={{ animationDelay: '60ms' }}>
            Study with intent. <span className="gradient-text">See it add up.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-ink-400 animate-fade-up sm:text-lg lg:mx-0" style={{ animationDelay: '120ms' }}>
            A focus timer that survives anything, honest metrics on how you actually work, and a weekly review that tells you what to change.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 animate-fade-up sm:flex-row lg:justify-start" style={{ animationDelay: '180ms' }}>
            <Button size="xl" onClick={onRegister} icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              Start for free
            </Button>
            <Button size="xl" variant="secondary" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-up lg:justify-start" style={{ animationDelay: '240ms' }} aria-label="Promises">
            {PROMISES.map((p) => (
              <li key={p.text} className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-400">
                <p.icon className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-lg animate-scale-in" style={{ animationDelay: '200ms' }}>
          <FloatingCards />
          <div className="card relative p-6 sm:p-8">
            <p className="eyebrow mb-4 text-center">Try it now, no account needed</p>
            <DemoTimer onSave={onDemoFinished} />
          </div>
        </div>
      </div>
    </section>
  )
}
