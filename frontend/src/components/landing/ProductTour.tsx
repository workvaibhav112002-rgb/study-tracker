import React, { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import confetti from 'canvas-confetti'
import { TOUR_STEPS, stepAt } from '../../lib/tour'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { BadgeScene, HeatmapScene, ShareScene, StreakScene, TimerScene, type SceneProps } from './TourScenes'

const SCENES: Record<string, React.FC<SceneProps>> = { timer: TimerScene, heatmap: HeatmapScene, streak: StreakScene, badge: BadgeScene, share: ShareScene }

/**
 * Auto-playing tour of the product with example data. One animation frame
 * loop that only advances while the tab is visible and the tour is on screen.
 */
const ProductTour: React.FC = () => {
  const reduced = useReducedMotion()
  const [playing, setPlaying] = useState(true)
  const [frame, setFrame] = useState({ index: 0, progress: 0 })
  const elapsed = useRef(0)
  const container = useRef<HTMLElement>(null)
  const onScreen = useRef(true)
  const firedFor = useRef(-1)

  useEffect(() => {
    if (reduced || !playing) return
    let raf = 0
    let last = performance.now()
    let lastCommit = -1
    const loop = (now: number) => {
      const dt = now - last
      last = now
      if (document.visibilityState === 'visible' && onScreen.current) {
        elapsed.current += dt
        const s = stepAt(elapsed.current)
        const key = s.index * 100 + Math.round(s.progress * 20)
        if (key !== lastCommit) {
          lastCommit = key
          setFrame(s)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced, playing])

  useEffect(() => {
    const el = container.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      onScreen.current = e.isIntersecting
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // One confetti burst per cycle when the badge unlocks.
  useEffect(() => {
    if (reduced || frame.index !== 3 || frame.progress < 0.25) return
    const cycle = Math.floor(elapsed.current / 17_500)
    if (firedFor.current === cycle || !container.current) return
    firedFor.current = cycle
    const r = container.current.getBoundingClientRect()
    confetti({ particleCount: 50, spread: 60, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: Math.min(0.95, (r.top + r.height / 2) / window.innerHeight) }, colors: ['#34d399', '#4cc2f5', '#f5b63d', '#8b7cf6'] })
  }, [frame, reduced])

  const jump = (i: number) => {
    elapsed.current = TOUR_STEPS.slice(0, i).reduce((s, x) => s + x.durationMs, 0)
    setFrame({ index: i, progress: 0 })
  }

  if (reduced) {
    return (
      <section ref={container} className="mt-20" aria-label="Product tour">
        <p className="eyebrow mb-3 text-center">Example data</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TOUR_STEPS.map((s) => {
            const Scene = SCENES[s.id]
            return (
              <div key={s.id} className="card p-4">
                <Scene progress={1} />
                <h3 className="mt-2 text-sm font-semibold text-ink-50">{s.title}</h3>
                <p className="mt-1 text-xs text-ink-500">{s.caption}</p>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  const step = TOUR_STEPS[frame.index]
  const Scene = SCENES[step.id]
  return (
    <section ref={container} className="mt-20" aria-label="Product tour" aria-roledescription="carousel">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">What it looks like</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">A week in Study Tracker</h2>
        </div>
        <span className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-500">Example data</span>
      </div>
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="grid items-center gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3" aria-live="off">
            <div key={step.id} className="animate-fade-in">
              <Scene progress={frame.progress} />
            </div>
          </div>
          <div className="lg:col-span-2">
            <h3 key={step.id} className="text-xl font-semibold text-ink-50 animate-fade-up">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">{step.caption}</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex items-center gap-1.5" role="group" aria-label="Tour steps">
                {TOUR_STEPS.map((s, i) => (
                  <button key={s.id} type="button" onClick={() => jump(i)} aria-label={`Show: ${s.title}`} aria-current={i === frame.index ? 'step' : undefined} className={`focus-ring h-1.5 rounded-full transition-all ${i === frame.index ? 'w-8 bg-brand-400' : 'w-3 bg-fg/[0.12] hover:bg-fg/[0.25]'}`} />
                ))}
              </div>
              <button type="button" onClick={() => setPlaying((p) => !p)} className="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-400 hover:text-ink-100" aria-pressed={!playing}>
                {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                {playing ? 'Pause tour' : 'Play tour'}
              </button>
            </div>
            <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-fg/[0.06]" aria-hidden="true">
              <div className="h-full bg-brand-500/70" style={{ width: `${frame.progress * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductTour
