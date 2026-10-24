import React, { useState } from 'react'
import { Users, Link2, Copy, Check, Trophy, Flame, UserMinus, RefreshCw } from 'lucide-react'
import type { DashboardStats, Friend, User } from '../types'
import { buildLeaderboard } from '../lib/leaderboard'
import { formatMinutes } from '../lib/time'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useToast } from './ui/Toast'
import { errorMessage } from '../api/client'

interface Props {
  user: User
  stats: DashboardStats | null
  friends: Friend[]
  loaded: boolean
  error: string | null
  onInvite: () => Promise<{ url: string; expires_at: string }>
  onRemove: (id: number) => Promise<void>
  onRefresh: () => Promise<void>
}

export const FriendsPanel: React.FC<Props> = ({ user, stats, friends, loaded, error, onInvite, onRemove, onRefresh }) => {
  const toast = useToast()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<Friend | null>(null)

  const studying = friends.filter((f) => f.studying)
  const board = buildLeaderboard(friends, {
    id: user.id,
    name: user.name,
    handle: user.handle ?? null,
    week_minutes: stats?.weekly_minutes ?? 0,
    today_minutes: stats?.today_minutes ?? 0,
    current_streak_days: stats?.current_streak_days ?? 0,
  })

  const invite = async () => {
    setBusy(true)
    try {
      const inv = await onInvite()
      setInviteUrl(inv.url)
      setCopied(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('Invite link copied. It works once and expires in 7 days.')
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-2 pb-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Study together</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">Friends</h2>
          <p className="mt-1.5 text-sm text-ink-400">See who is focusing right now and keep each other honest with a weekly leaderboard.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="lg" onClick={() => void onRefresh()} icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} aria-label="Refresh friends">
            Refresh
          </Button>
          <Button size="lg" onClick={invite} loading={busy} icon={<Link2 className="h-4 w-4" aria-hidden="true" />}>
            Invite a friend
          </Button>
        </div>
      </div>

      {inviteUrl && (
        <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center" role="status">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink-100">Share this link with one friend</p>
            <p className="mt-1 truncate font-mono text-xs text-ink-400" title={inviteUrl}>
              {inviteUrl}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={copy} icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-rose-300">
          {error}
        </p>
      )}

      {loaded && friends.length === 0 && !error && (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10 text-brand-300">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-ink-50">No friends yet</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-400">Generate an invite link and send it to someone you study with. They accept it once, and you both appear on each other&apos;s list.</p>
        </div>
      )}

      {friends.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-5">
          <section className="card p-5 lg:col-span-2" aria-label="Focusing now">
            <h3 className="eyebrow mb-3">Focusing now</h3>
            {studying.length === 0 ? (
              <p className="text-sm text-ink-500">Nobody is in a focus session right now. Start one and they will see you here.</p>
            ) : (
              <ul className="space-y-2">
                {studying.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3 py-2.5">
                    <span className="h-2 w-2 animate-breathe rounded-full bg-brand-400" aria-hidden="true" />
                    <span className="text-[13px] font-medium text-ink-50">{f.name}</span>
                    <span className="ml-auto text-[11px] text-ink-500">in a focus session</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5 lg:col-span-3" aria-label="Weekly leaderboard">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="eyebrow">This week</h3>
              <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
            </div>
            <ol className="divide-y divide-fg/[0.06]">
              {board.map((r) => (
                <li key={r.id} className={`flex items-center gap-3 py-2.5 ${r.me ? 'text-ink-50' : 'text-ink-200'}`}>
                  <span className={`w-6 text-center font-mono text-xs tabular-nums ${r.rank === 1 ? 'text-amber-400' : 'text-ink-500'}`}>{r.rank}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {r.studying && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-label="focusing now" />}
                    <span className="truncate text-[13px] font-medium">
                      {r.name}
                      {r.me && <span className="ml-1.5 text-[11px] font-normal text-ink-500">you</span>}
                    </span>
                    {r.handle && <span className="hidden truncate text-[11px] text-ink-500 sm:inline">@{r.handle}</span>}
                  </span>
                  <span className="chip border-orange-400/20 bg-orange-400/10 text-orange-300" title="Study streak">
                    <Flame className="h-3 w-3 fill-current" aria-hidden="true" />
                    {r.current_streak_days}d
                  </span>
                  <span className="w-16 text-right font-mono text-xs tabular-nums">{formatMinutes(r.week_minutes)}</span>
                  {!r.me && (
                    <button type="button" onClick={() => setRemoving(friends.find((f) => f.id === r.id) ?? null)} className="focus-ring rounded-md p-1 text-ink-600 hover:text-rose-300" aria-label={`Remove ${r.name}`}>
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      <ConfirmDialog
        isOpen={removing !== null}
        onCancel={() => setRemoving(null)}
        title="Remove friend?"
        message={`${removing?.name ?? ''} will disappear from your list, and you from theirs. You can always invite them again.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return
          try {
            await onRemove(removing.id)
            toast.info('Friend removed.')
          } catch (err) {
            toast.error(errorMessage(err))
          }
          setRemoving(null)
        }}
      />
    </div>
  )
}
