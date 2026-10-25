import React from 'react'
import { Flame, CalendarCheck, Sunrise } from 'lucide-react'

const CARDS = [
  { icon: Flame, label: 'Streak', value: '12 days', tone: 'text-orange-300', pos: '-left-24 top-2', delay: '0s', depth: '28px' },
  { icon: CalendarCheck, label: 'This week', value: '9h 00m', tone: 'text-brand-300', pos: '-right-24 top-28', delay: '0.9s', depth: '20px' },
  { icon: Sunrise, label: 'Best hour', value: '9 to 10 am', tone: 'text-sky-300', pos: '-left-16 -bottom-8', delay: '1.7s', depth: '36px' },
]

/** Decorative example stats that drift around the hero timer on large screens. */
export const FloatingCards: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
    {CARDS.map((c) => (
      <div key={c.label} className={`parallax-layer absolute ${c.pos}`} style={{ '--depth': c.depth } as React.CSSProperties}>
        <div className="glass animate-float flex items-center gap-3 rounded-2xl px-4 py-3 shadow-card" style={{ animationDelay: c.delay }}>
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-fg/[0.05] ${c.tone}`}>
            <c.icon className="h-4 w-4" />
          </span>
          <span>
            <span className="eyebrow block">{c.label}</span>
            <span className="block font-mono text-sm tabular-nums text-ink-50">{c.value}</span>
          </span>
          <span className="ml-1 rounded-md bg-fg/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-500">example</span>
        </div>
      </div>
    ))}
  </div>
)
