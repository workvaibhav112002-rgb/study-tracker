export interface User {
  id: number
  email: string
  name: string
  created_at?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Project {
  id: number
  user_id?: number
  name: string
  color: string
  description: string
  target_minutes_per_day: number
  created_at?: string
  total_minutes?: number
}

export interface ProjectInput {
  name: string
  color: string
  description: string
  target_minutes_per_day: number
}

export type SessionType = 'pomodoro' | 'custom' | 'manual'

export interface Session {
  id: number
  user_id?: number
  project_id: number
  project_name?: string
  project_color?: string
  start_time: string
  end_time: string
  duration_seconds: number
  session_type: SessionType
  focus_rating: number
  notes: string
  created_at?: string
}

export interface SessionInput {
  project_id: number
  start_time: string
  end_time: string
  duration_seconds: number
  session_type: SessionType
  focus_rating: number
  notes: string
}

export interface Settings {
  work_duration: number
  short_break_duration: number
  long_break_duration: number
  long_break_interval: number
  auto_start_breaks: boolean
  sound_enabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  work_duration: 25,
  short_break_duration: 5,
  long_break_duration: 15,
  long_break_interval: 4,
  auto_start_breaks: false,
  sound_enabled: true,
}

/** Server-side limits, mirrored for form validation. */
export const SETTINGS_LIMITS = {
  work_duration: { min: 1, max: 180 },
  short_break_duration: { min: 1, max: 60 },
  long_break_duration: { min: 1, max: 120 },
  long_break_interval: { min: 1, max: 12 },
} as const

export interface ProjectStat {
  project_id: number
  name: string
  color: string
  total_seconds: number
  session_count: number
}

export interface DailyStat {
  date: string
  minutes: number
}

export interface DashboardStats {
  today_minutes: number
  weekly_minutes: number
  total_minutes: number
  current_streak_days: number
  completed_pomodoros: number
  project_stats: ProjectStat[]
  daily_trend: DailyStat[]
}

export type TimerMode = 'work' | 'short_break' | 'long_break'

export type FeedbackType = 'feature' | 'bug' | 'praise' | 'general'

export interface FeedbackSubmission {
  type: FeedbackType
  message: string
  email?: string
}
