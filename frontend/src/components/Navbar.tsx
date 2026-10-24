import React from 'react'
import { Timer, BarChart3, FolderKanban, History, Settings as SettingsIcon, Flame, LogOut } from 'lucide-react'
import type { DashboardStats, User } from '../types'
import { formatMinutes } from '../lib/time'

export type Tab = 'timer' | 'projects' | 'history' | 'analytics'

interface NavbarProps {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  onOpenSettings: () => void
  onLogout: () => void
  stats: DashboardStats | null
  user: User | null
  timerRunning: boolean
  timerLabel: string
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'timer', label: 'Focus', icon: Timer },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'history', label: 'History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

const Logo: React.FC = () => (
  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700 shadow-glow" aria-hidden="true">
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-surface-950" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  </div>
)

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  onLogout,
  stats,
  user,
  timerRunning,
  timerLabel,
}) => (
  <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
    <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-2xl px-2.5 shadow-card sm:px-3">
      <div className="flex min-w-0 items-center gap-3 pl-1">
        <Logo />
        <span className="hidden items-center gap-1 text-[15px] font-semibold tracking-tight text-ink-50 md:flex">
          Study<span className="text-brand-400">Tracker</span>
        </span>
        {timerRunning && activeTab !== 'timer' && (
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="focus-ring chip border-brand-500/25 bg-brand-500/10 font-mono tabular-nums text-brand-300 hover:bg-brand-500/20"
            aria-label={`Timer running, ${timerLabel} remaining. Go to timer.`}
          >
            <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-brand-400" aria-hidden="true" />
            {timerLabel}
          </button>
        )}
      </div>

      {user && (
      <nav aria-label="Primary" className="flex items-center gap-0.5 rounded-xl border border-fg/[0.06] bg-surface-950/60 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              title={tab.label}
              className={`focus-ring flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ease-premium ${
                isActive ? 'bg-fg/[0.08] text-ink-50 shadow-inner-hi' : 'text-ink-400 hover:bg-fg/[0.04] hover:text-ink-100'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-brand-400' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        {stats && user && (
          <div className="hidden items-center gap-1.5 lg:flex">
            <div className="chip border-orange-400/20 bg-orange-400/10 text-orange-300" title="Current streak">
              <Flame className="h-3.5 w-3.5 fill-orange-400 text-orange-400" aria-hidden="true" />
              {stats.current_streak_days}d
            </div>
            <div className="chip border-fg/[0.06] bg-fg/[0.04] text-ink-300" title="Studied today">
              <span className="text-ink-500">Today</span>
              <span className="text-ink-50">{formatMinutes(stats.today_minutes)}</span>
            </div>
          </div>
        )}

        {user && (
          <div className="flex items-center gap-1">
            <div
              className="flex items-center gap-2 rounded-xl border border-fg/[0.06] bg-fg/[0.04] py-1 pl-1 pr-2.5 text-xs"
              title={user.email}
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-surface-950"
                aria-hidden="true"
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden max-w-[110px] truncate font-medium text-ink-200 sm:inline">{user.name}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="focus-ring rounded-xl p-2 text-ink-500 transition-colors hover:bg-fg/[0.06] hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {user && (
        <button
          type="button"
          onClick={onOpenSettings}
          title="Timer settings"
          aria-label="Timer settings"
          className="focus-ring rounded-xl p-2 text-ink-400 transition-colors hover:bg-fg/[0.06] hover:text-ink-50"
        >
          <SettingsIcon className="h-[18px] w-[18px]" />
        </button>
        )}
      </div>
    </div>
  </header>
)
