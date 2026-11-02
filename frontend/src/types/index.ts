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
  handle?: string | null
  profile_public?: boolean
  bio?: string
}

export interface ProfileInput {
  handle: string | null
  profile_public: boolean
  bio: string
}

export interface PublicProfile {
  name: string
  handle: string
  bio: string
  member_since: string
  total_minutes: number
  sessions: number
  current_streak_days: number
  goal_streak_days: number
  week_minutes: number
  heatmap: DailyStat[]
  badges: Milestone[]
}

export interface Friend {
  id: number
  name: string
  handle: string | null
  studying: boolean
  today_minutes: number
  week_minutes: number
  current_streak_days: number
}

export interface FriendInvite {
  token: string
  url: string
  expires_at: string
}

export interface AppConfig {
  email_enabled: boolean
  google_client_id: string
  app_url: string
  vapid_public_key?: string
}

export interface GoalStreak {
  days: number
  best_days: number
  target_minutes: number
  today_met: boolean
  yesterday_met: boolean
  day_before_met: boolean
  freeze_available: boolean
  freeze_days: string[]
  missed_yesterday: string
}

export interface Milestone {
  id: string
  title: string
  description: string
  icon: string
  target: number
  progress: number
  achieved: boolean
  achieved_at: string | null
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
  exam_template?: ExamTemplate | null
  journal_config?: JournalConfig | null
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
  reminder_enabled: boolean
  reminder_hour: number
  timezone: string
}

export const DEFAULT_SETTINGS: Settings = {
  work_duration: 25,
  short_break_duration: 5,
  long_break_duration: 15,
  long_break_interval: 4,
  auto_start_breaks: false,
  sound_enabled: true,
  reminder_enabled: false,
  reminder_hour: 9,
  timezone: 'UTC',
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

// ---- Mock tests and mistake log ----

export interface ExamSection {
  name: string
  questions: number
  marks_each: number
  minutes: number
}

export interface ExamTemplate {
  key: string
  sections: ExamSection[]
  /** Share of a question's marks lost per wrong answer, e.g. 0.25. */
  negative_fraction: number
  target_score: number
  accuracy_threshold: number
  penalty_limit: number
}

export interface MockSection {
  name: string
  questions: number
  correct: number
  incorrect: number
  seconds: number
  marks_each: number
  negative_each: number
}

export interface Mock {
  id: number
  project_id: number
  name: string
  provider: string
  attempted_on: string
  percentile: number | null
  rank: number | null
  sections: MockSection[]
  notes: string
  created_at?: string
  updated_at?: string
}

export type MockInput = Omit<Mock, 'id' | 'created_at' | 'updated_at'>

export type MistakeStatus = 'active' | 'locked_in' | 'review_next_week' | 'needs_drill'
export type MistakeGrade = Exclude<MistakeStatus, 'active'>

/** Category key -> option key or free text (string[] for multi-select). */
export type MistakeTags = Record<string, string | string[]>
export type MistakeExtra = Record<string, string | number | boolean>

export interface Mistake {
  id: number
  project_id: number
  mock_id: number | null
  tags: MistakeTags
  extra: MistakeExtra
  question: string
  rule: string
  solution: string
  actual_seconds: number | null
  ideal_seconds: number | null
  status: MistakeStatus
  last_reviewed_at: string | null
  created_at: string
  updated_at?: string
}

export interface MistakeInput {
  project_id: number
  mock_id: number | null
  tags: MistakeTags
  extra: MistakeExtra
  question: string
  rule: string
  solution: string
  actual_seconds: number | null
  ideal_seconds: number | null
  status?: MistakeStatus
}

export interface JournalOption {
  key: string
  label: string
  color: string
}

export interface JournalCategory {
  key: string
  label: string
  multi: boolean
  required: boolean
  allow_new: boolean
  options: JournalOption[]
}

export type JournalFieldType = 'builtin' | 'text' | 'number' | 'yesno' | 'select'

export interface JournalField {
  key: string
  label: string
  type: JournalFieldType
  hidden: boolean
  options?: string[]
}

export interface JournalConfig {
  version: number
  preset: string
  categories: JournalCategory[]
  fields: JournalField[]
  patterns: { threshold: number; window_days: number; watch: string[][] }
  review_weekday: number
  tests_enabled: boolean
}

export interface PatternAlert {
  project_id: number
  categories: string[]
  values: string[]
  count: number
  last_at: string
  mistake_ids: number[]
}

export interface MistakeImportResult {
  rows: number
  valid: number
  imported: number
  dry_run: boolean
  errors: { row: number; message: string }[]
  sample: { tags: MistakeTags; question: string }[]
}
