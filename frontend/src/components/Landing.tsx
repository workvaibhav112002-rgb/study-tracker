import React, { Suspense, lazy } from 'react'
import { ArrowRight } from 'lucide-react'
import type { DemoSession } from '../lib/demoTimer'
import { Button } from './ui/Button'
import { Skeleton } from './ui/Skeleton'
import { Hero } from './landing/Hero'
import { Features } from './landing/Features'

const ProductTour = lazy(() => import('./landing/ProductTour'))

interface Props {
  onSignIn: () => void
  onRegister: () => void
  onDemoFinished: (session: DemoSession, intent: 'register' | 'login') => void
}

/** Logged-out home: try the timer, watch the tour, read the features, sign up. */
export const Landing: React.FC<Props> = ({ onSignIn, onRegister, onDemoFinished }) => (
  <div className="mx-auto max-w-6xl overflow-x-clip px-2 pb-16 pt-4 sm:pt-8">
    <Hero onSignIn={onSignIn} onRegister={onRegister} onDemoFinished={onDemoFinished} />
    <Suspense fallback={<Skeleton className="mt-20 h-80 rounded-3xl" />}>
      <ProductTour />
    </Suspense>
    <Features />
    <section className="card relative mt-20 overflow-hidden p-8 text-center sm:p-12" aria-label="Get started">
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-56 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-3xl" />
      <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">Your first session is one click away.</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-400">Free, private, and yours to export. The timer above already counts.</p>
      <div className="mt-6 flex justify-center">
        <Button size="xl" onClick={onRegister} icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
          Create your account
        </Button>
      </div>
    </section>
  </div>
)
