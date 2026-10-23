import React, { useState, useEffect, useCallback } from 'react'
import { Navbar } from './components/Navbar'
import { PomodoroTimer } from './components/PomodoroTimer'
import { SessionModal } from './components/SessionModal'
import { ManualSessionModal } from './components/ManualSessionModal'
import { ProjectManager } from './components/ProjectManager'
import { HistoryTable } from './components/HistoryTable'
import { AnalyticsDashboard } from './components/AnalyticsDashboard'
import { SettingsModal } from './components/SettingsModal'
import { AuthModal } from './components/AuthModal'
import { FeedbackModal } from './components/FeedbackModal'
import { MessageSquareHeart } from 'lucide-react'
import { api, tokenStorage } from './api/client'
import { DashboardStats, Project, Session, Settings, User } from './types'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timer' | 'projects' | 'history' | 'analytics'>('timer')
  const [user, setUser] = useState<User | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [settings, setSettings] = useState<Settings>({
    work_duration: 25,
    short_break_duration: 5,
    long_break_duration: 15,
    long_break_interval: 4,
    auto_start_breaks: false,
    sound_enabled: true,
  })

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [completedSessionData, setCompletedSessionData] = useState<{
    durationSeconds: number
    startTime: string
    endTime: string
    projectId: number
  } | null>(null)

  // Load user data
  const loadUserData = useCallback(async () => {
    try {
      const [fetchedProjects, fetchedSettings, fetchedStats, fetchedSessions] = await Promise.all([
        api.getProjects(),
        api.getSettings(),
        api.getDashboardStats(),
        api.getSessions(),
      ])

      setProjects(fetchedProjects)
      if (fetchedProjects.length > 0) {
        setSelectedProjectId((prev) => (prev ? prev : fetchedProjects[0].id))
      }
      setSettings(fetchedSettings)
      setStats(fetchedStats)
      setSessions(fetchedSessions)
    } catch (err) {
      console.error('Error loading study tracker data:', err)
    }
  }, [])

  // Check initial authentication
  useEffect(() => {
    const token = tokenStorage.get()
    if (token) {
      api
        .getMe()
        .then((userData) => {
          setUser(userData)
          loadUserData()
        })
        .catch(() => {
          tokenStorage.clear()
          setUser(null)
          setIsAuthModalOpen(true)
        })
    } else {
      setIsAuthModalOpen(true)
    }
  }, [loadUserData])

  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser)
    loadUserData()
  }

  const handleLogout = () => {
    tokenStorage.clear()
    setUser(null)
    setProjects([])
    setSessions([])
    setStats(null)
    setIsAuthModalOpen(true)
  }

  // Handle Work Session Completion
  const handleWorkSessionComplete = (
    durationSeconds: number,
    startTime: string,
    endTime: string,
    projectId: number
  ) => {
    if (!user) {
      setIsAuthModalOpen(true)
      return
    }
    setCompletedSessionData({
      durationSeconds,
      startTime,
      endTime,
      projectId,
    })
  }

  // Save session from Post-Pomodoro modal
  const handleSaveCompletedSession = async (rating: number, notes: string) => {
    if (!completedSessionData) return

    try {
      await api.createSession({
        project_id: completedSessionData.projectId,
        start_time: completedSessionData.startTime,
        end_time: completedSessionData.endTime,
        duration_seconds: completedSessionData.durationSeconds,
        session_type: 'pomodoro',
        focus_rating: rating,
        notes,
      })
      setCompletedSessionData(null)
      await loadUserData()
    } catch (err) {
      console.error('Failed to save pomodoro session:', err)
    }
  }

  // Save manual session entry
  const handleSaveManualSession = async (sessionData: Omit<Session, 'id' | 'created_at'>) => {
    try {
      await api.createSession(sessionData)
      await loadUserData()
    } catch (err) {
      console.error('Failed to create manual session:', err)
    }
  }

  // Delete session
  const handleDeleteSession = async (id: number) => {
    try {
      await api.deleteSession(id)
      await loadUserData()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  // Project CRUD
  const handleCreateProject = async (data: Partial<Project>) => {
    try {
      await api.createProject(data)
      await loadUserData()
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  const handleUpdateProject = async (id: number, data: Partial<Project>) => {
    try {
      await api.updateProject(id, data)
      await loadUserData()
    } catch (err) {
      console.error('Failed to update project:', err)
    }
  }

  const handleDeleteProject = async (id: number) => {
    try {
      await api.deleteProject(id)
      await loadUserData()
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  // Update Settings
  const handleSaveSettings = async (newSettings: Settings) => {
    try {
      const saved = await api.updateSettings(newSettings)
      setSettings(saved)
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  }

  const activeProject = projects.find((p) => p.id === (completedSessionData?.projectId || selectedProjectId))

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        stats={stats}
        user={user}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4">
        {activeTab === 'timer' && (
          <PomodoroTimer
            projects={projects}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            settings={settings}
            onWorkSessionComplete={handleWorkSessionComplete}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectManager
            projects={projects}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTable
            sessions={sessions}
            projects={projects}
            onDeleteSession={handleDeleteSession}
            onOpenManualModal={() => {
              if (!user) {
                setIsAuthModalOpen(true)
                return
              }
              setIsManualModalOpen(true)
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard stats={stats} projects={projects} />
        )}
      </main>

      {/* Post-Pomodoro Log Modal */}
      <SessionModal
        isOpen={Boolean(completedSessionData)}
        onClose={() => setCompletedSessionData(null)}
        onSave={handleSaveCompletedSession}
        durationSeconds={completedSessionData?.durationSeconds || 0}
        project={activeProject}
      />

      {/* Manual Entry Modal */}
      <ManualSessionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleSaveManualSession}
        projects={projects}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Auth Modal (Sign In / Register) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Floating Feedback Button */}
      <button
        onClick={() => setIsFeedbackOpen(true)}
        title="Share your feedback or suggest a feature"
        className="fixed bottom-5 right-5 z-40 flex items-center space-x-2 px-3.5 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-brand-500/80 shadow-2xl backdrop-blur transition-all hover:scale-105 active:scale-95 text-xs font-semibold"
      >
        <MessageSquareHeart className="w-4 h-4 text-brand-400" />
        <span>Feedback</span>
      </button>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        userEmail={user?.email}
      />
    </div>
  )
}
