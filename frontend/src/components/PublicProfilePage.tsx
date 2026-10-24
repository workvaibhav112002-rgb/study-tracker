import React, { useEffect, useState } from 'react'
import { Flame, Clock, Target, CalendarDays, Award, ArrowLeft } from 'lucide-react'
import type { PublicProfile } from '../types'
import { api, errorMessage } from '../api/client'
import { formatMinutes } from '../lib/time'
import { Button } from './ui/Button'

interface Props {
  handle: string
  onHome: () => void
}

/** Anonymous page at /u/{handle}. Only data the owner chose to publish. */
export const PublicProfilePage: React.FC<Props> = ({ handle, onHome }) => {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getPublicProfile(handle)
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'This profile is private or does not exist.'))
      })
    return () => {
      cancelled = true
    }
  }, [handle])

  if (error) {
    return (
      <div className="card mx-auto mt-16 max-w-md px-6 py-12 text-center">
        <p className="text-sm text-ink-300">{error}</p>
        <Button className="mt-5" variant="secondary" onClick={onHome} icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
          Back to Study Tracker
        </Button>
      </div>
    )
  }
  if (!profile) {
    return (
      <p className="mt-16 text-center text-sm text-ink-500" role="status">
        Loading profile…
      </p>
    )
  }

  const tiles = [
    { label: 'Total focus', value: formatMinutes(profile.total_minutes), icon: Clock, tone: 'text-brand-300 bg-brand-500/10 border-brand-500/20' },
    { label: 'This week', value: formatMinutes(profile.week_minutes), icon: CalendarDays, tone: 'text-sky-300 bg-sky-400/10 border-sky-400/20' },
    { label: 'Study streak', value: `${profile.current_streak_days}d`, icon: Flame, tone: 'text-orange-300 bg-orange-400/10 border-orange-400/20' },
    { label: 'Goal streak', value: `${profile.goal_streak_days}d`, icon: Target, tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
  ]
  const peak = Math.max(1, ...profile.heatmap.map((d) => d.minutes))

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10" aria-label={`${profile.name}'s public profile`}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Public profile</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-50">{profile.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            @{profile.handle} · member since {profile.member_since}
          </p>
          {profile.bio && <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-300">{profile.bio}</p>}
        </div>
        <Button variant="secondary" onClick={onHome} icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
          Study Tracker
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t.label}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${t.tone}`}>
                <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-ink-50">{t.value}</p>
          </div>
        ))}
      </div>

      <section className="card mb-6 p-5" aria-label="Last 13 weeks">
        <h2 className="eyebrow mb-3">Last 13 weeks</h2>
        <div className="flex h-20 items-end gap-[2px]" role="img" aria-label={`Minutes per day over the last ${profile.heatmap.length} days`}>
          {profile.heatmap.map((d) => (
            <div key={d.date} className={`flex-1 rounded-t-[2px] ${d.minutes > 0 ? 'bg-brand-500' : 'bg-fg/[0.05]'}`} style={{ height: `${Math.max(d.minutes > 0 ? 6 : 2, (d.minutes / peak) * 100)}%` }} title={`${d.date}: ${formatMinutes(d.minutes)}`} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-500">{profile.sessions} sessions logged in total.</p>
      </section>

      <section className="card p-5" aria-label="Badges">
        <div className="mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <h2 className="eyebrow">Badges</h2>
        </div>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-ink-500">No badges yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.badges.map((b) => (
              <li key={b.id} className="chip border-brand-500/20 bg-brand-500/10 text-brand-200" title={b.description}>
                {b.title}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
