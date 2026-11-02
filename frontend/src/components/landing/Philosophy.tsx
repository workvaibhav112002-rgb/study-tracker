import React from 'react'
import { Microscope, Footprints, Wrench } from 'lucide-react'
import { BRAND } from '../../lib/brand'

const PILLARS = [
  {
    icon: Microscope,
    title: 'High-resolution awareness',
    text: 'Hours at a desk are a vanity metric. What matters is the texture of that time: the exact moments that pull you out of flow.',
    feature: 'Every pause and tab switch is counted, and you see your best hours.',
  },
  {
    icon: Footprints,
    title: 'Mistakes are signals, not failures',
    text: 'Each slip is a breadcrumb from your mental model. Collect them for a few weeks and the recurring ones stop happening.',
    feature: 'Mistake Lab finds the slips you keep repeating.',
  },
  {
    icon: Wrench,
    title: 'Inspect, don’t grind',
    text: 'Not more hours. Root-cause analysis for your own work: look closer, fix the small habit, move on.',
    feature: 'Weekly review and Focus next tell you what to fix first.',
  },
]

/** The philosophy behind the product, one card per pillar. */
export const Philosophy: React.FC = () => (
  <section className="mt-20" aria-labelledby="philosophy-heading">
    <p className="eyebrow">The {BRAND.name} way</p>
    <h2 id="philosophy-heading" className="mt-1 max-w-2xl text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">
      Big results are decided by small moments.
    </h2>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-400">
      Most tools measure focus in hours and days. Deep work doesn’t break at the hour mark. It breaks in seconds: a three-second distraction, a two-second wrong assumption, one tired keystroke. {BRAND.name} treats those moments as data worth keeping.
    </p>
    <div className="stagger mt-8 grid gap-4 md:grid-cols-3">
      {PILLARS.map((p, i) => {
        const Icon = p.icon
        return (
          <article key={p.title} className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs text-ink-500">0{i + 1}</span>
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-ink-50">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{p.text}</p>
            <p className="mt-4 border-t border-fg/[0.06] pt-3 text-xs text-ink-300">{p.feature}</p>
          </article>
        )
      })}
    </div>
  </section>
)
