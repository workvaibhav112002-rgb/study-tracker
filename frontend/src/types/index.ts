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

export interface Session {
  id: number
  user_id?: number
  project_id: number
  project_name?: string
  project_color?: string
  start_time: string
  end_time: string
  duration_seconds: number
  session_type: 'pomodoro' | 'custom' | 'manual'
  focus_rating: number
  notes: string
  created_at?: string
}

export interface Settings {
  work_duration: number
  short_break_duration: number
  long_break_duration: number
  long_break_interval: number
  auto_start_breaks: boolean
  sound_enabled: boolean
}

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

export interface FeedbackSubmission {
  type: 'feature' | 'bug' | 'praise' | 'general'
  message: string
  email?: string
}
