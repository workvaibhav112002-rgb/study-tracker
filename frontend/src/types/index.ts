export interface User {
  id: number
  email: string
  name: string
  created_at?: string
  updated_at?: string
  has_calendar_token?: boolean
  has_password?: boolean
  google_linked?: boolean
  email_verified_at?: string | null
}

export interface AppConfig {
  email_enabled: boolean
  google_client_id: string
  app_url: string
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
  exam_date?: string | null
  planned_hours_per_week?: number | null
  created_at?: string
  total_minutes?: number
  week_minutes?: number
}

export interface ProjectInput {
  name: string
  color: string
  description: string
  target_minutes_per_day: number
  exam_date?: string | null
  planned_hours_per_week?: number | null
}

export interface Card {
  id: number
  project_id: number
  front: string
  back: string
  tags: string[]
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: string
  archived: boolean
  created_at?: string
  updated_at?: string
}

export interface CardInput {
  project_id: number
  front: string
  back: string
  tags: string[]
}

export interface CardStats {
  total: number
  due: number
  new: number
  mastered: number
  reviewed_last_7_days: number
}

export type CardRating = 1 | 2 | 3 | 4

export interface Note {
  id: number
  project_id: number | null
  title: string
  body: string
  tags: string[]
  pinned: boolean
  created_at?: string
  updated_at?: string
}

export interface NoteInput {
  project_id: number | null
  title: string
  body: string
  tags: string[]
  pinned: boolean
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
  interruptions?: number
  task_id?: number | null
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
  interruptions?: number
  task_id?: number | null
}

export interface Task {
  id: number
  user_id?: number
  project_id: number
  title: string
  estimate_pomodoros: number
  completed_pomodoros: number
  done: boolean
  position: number
  created_at?: string
  completed_at?: string | null
}

export interface TaskInput {
  project_id: number
  title: string
  estimate_pomodoros: number
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

export interface WeekOverWeek {
  this_week_minutes: number
  previous_week_minutes: number
  delta_minutes: number
  delta_percent: number | null
}

export interface DashboardStats {
  today_minutes: number
  weekly_minutes: number
  total_minutes: number
  current_streak_days: number
  completed_pomodoros: number
  avg_interruptions?: number
  week_over_week?: WeekOverWeek
  project_stats: ProjectStat[]
  daily_trend: DailyStat[]
}

export interface GoalStat {
  project_id: number
  name: string
  color: string
  target_minutes_per_day: number
  today_minutes: number
  percent: number
  met: boolean
}

export interface GoalsStats {
  date: string
  projects: GoalStat[]
  overall: { target_minutes: number; today_minutes: number; percent: number; met: boolean }
}

export interface HourStat {
  hour: number
  minutes: number
  session_count: number
  avg_rating: number
}

export interface WeeklyReview {
  week_start: string
  week_end: string
  minutes: number
  previous_minutes: number
  delta_percent: number | null
  sessions: number
  pomodoros: number
  active_days: number
  avg_rating: number
  avg_interruptions: number
  best_day: DailyStat | null
  top_project: ProjectStat | null
  top_project_share: number
  best_hour: number | null
  streak_days: number
  days: DailyStat[]
  insights: string[]
}

export interface TimerSnapshot<T = unknown> {
  state: T | null
  updated_at: number
}

export interface CalendarToken {
  token: string
  url: string
}

export interface ImportResult {
  projects_created: number
  projects_updated: number
  sessions_inserted: number
  sessions_skipped: number
}

export type TimerMode = 'work' | 'short_break' | 'long_break'

export type FeedbackType = 'feature' | 'bug' | 'praise' | 'general'

export interface FeedbackSubmission {
  type: FeedbackType
  message: string
  email?: string
}
