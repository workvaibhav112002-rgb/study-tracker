import React from 'react'
import { Timer, BarChart3, FolderKanban, History, Settings as SettingsIcon, Flame, Clock } from 'lucide-react'
import { DashboardStats } from '../types'

interface NavbarProps {
  activeTab: 'timer' | 'projects' | 'history' | 'analytics'
  setActiveTab: (tab: 'timer' | 'projects' | 'history' | 'analytics') => void
  onOpenSettings: () => void
  stats: DashboardStats | null
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  stats,
}) => {
  const tabs = [
    { id: 'timer', label: 'Pomodoro', icon: Timer },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'history', label: 'History', icon: History },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ] as const

  const formatHoursMinutes = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Clock className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Study<span className="text-brand-500">Tracker</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                Go + React
              </span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-brand-400 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right Action & Live Counters */}
        <div className="flex items-center space-x-3">
          {stats && (
            <div className="hidden md:flex items-center space-x-2 text-xs">
              {/* Daily Streak */}
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                <span>{stats.current_streak_days}d streak</span>
              </div>

              {/* Today Focus */}
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                <span className="text-slate-500">Today:</span>
                <span className="text-brand-400">{formatHoursMinutes(stats.today_minutes)}</span>
              </div>
            </div>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Settings"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
