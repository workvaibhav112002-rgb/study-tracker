import React from 'react'
import { Timer, BarChart3, FolderKanban, History, Settings as SettingsIcon, Flame, Clock, LogOut } from 'lucide-react'
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
  { id: 'timer', label: 'Pomodoro', icon: Timer },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'history', label: 'History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

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
  <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
          <Clock className="w-5 h-5 text-slate-950" aria-hidden="true" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white hidden sm:flex items-center gap-1.5">
          Study<span className="text-brand-500">Tracker</span>
        </span>
        {timerRunning && activeTab !== 'timer' && (
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="ml-1 text-xs font-mono font-semibold px-2 py-1 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20"
            aria-label={`Timer running, ${timerLabel} remaining. Go to timer.`}
          >
            {timerLabel}
          </button>
        )}
      </div>

      <nav aria-label="Primary" className="flex items-center space-x-1 sm:space-x-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
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
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isActive
                  ? 'bg-slate-800 text-brand-400 shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {stats && user && (
          <div className="hidden lg:flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
              <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400" aria-hidden="true" />
              <span>{stats.current_streak_days}d streak</span>
            </div>
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              <span className="text-slate-500">Today:</span>
              <span className="text-brand-400">{formatMinutes(stats.today_minutes)}</span>
            </div>
          </div>
        )}

        {user && (
          <div className="flex items-center space-x-2">
            <div
              className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-xl text-xs"
              title={user.email}
            >
              <div className="w-5 h-5 rounded-full bg-brand-500 text-slate-950 font-bold flex items-center justify-center text-[10px]" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-slate-200 font-medium max-w-[100px] truncate">{user.name}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          title="Timer settings"
          aria-label="Timer settings"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  </header>
)
