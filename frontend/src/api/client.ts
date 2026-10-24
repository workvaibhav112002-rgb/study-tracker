import type {
  AppConfig,
  AuthResponse,
  CalendarToken,
  DailyStat,
  DashboardStats,
  FeedbackSubmission,
  GoalsStats,
  HourStat,
  ImportResult,
  Project,
  ProjectInput,
  Session,
  SessionInput,
  Settings,
  Task,
  TaskInput,
  User,
} from '../types'
import { browserTimeZone } from '../lib/time'
import { captureException } from '../lib/monitoring'

const tz = () => encodeURIComponent(browserTimeZone())

/**
 * API origin resolution:
 *  - VITE_API_URL when set (any environment)
 *  - the production Render service in a production build
 *  - same-origin in development (Vite proxies /api → localhost:8080)
 */
const DEFAULT_PRODUCTION_API = 'https://study-tracker-s2ck.onrender.com'
const configured = import.meta.env.VITE_API_URL?.trim()
const origin = configured ? configured.replace(/\/$/, '') : import.meta.env.PROD ? DEFAULT_PRODUCTION_API : ''
export const BASE_URL = `${origin}/api`

const TOKEN_KEY = 'study_tracker_token'

export class ApiError extends Error {
  readonly status: number
  readonly requestId?: string
  constructor(status: number, message: string, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.requestId = requestId
  }
}

export class NetworkError extends Error {
  constructor(message = 'Cannot reach the server. Check your connection and try again.') {
    super(message)
    this.name = 'NetworkError'
  }
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable (private mode); session stays in memory only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

type Listener<T> = (value: T) => void

function emitter<T>() {
  const listeners = new Set<Listener<T>>()
  return {
    on(listener: Listener<T>) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(value: T) {
      listeners.forEach((l) => l(value))
    },
  }
}

/** Fires when an authenticated request is rejected with 401. */
export const unauthorizedEvents = emitter<void>()
/** Fires true while a request is taking long enough to suggest a cold start. */
export const serverWakingEvents = emitter<boolean>()

const RETRYABLE = new Set([502, 503, 504])
const SLOW_THRESHOLD_MS = 2500
const RETRY_DELAYS_MS = [2000, 4000, 8000]

let inflightSlow = 0
function markSlow(delta: number) {
  const before = inflightSlow > 0
  inflightSlow = Math.max(0, inflightSlow + delta)
  const after = inflightSlow > 0
  if (before !== after) serverWakingEvents.emit(after)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function parseError(res: Response): Promise<{ message: string; requestId?: string }> {
  const fallback = `Request failed (${res.status})`
  try {
    const text = await res.text()
    if (!text) return { message: fallback }
    try {
      const json = JSON.parse(text) as { error?: string; request_id?: string }
      return { message: json.error || fallback, requestId: json.request_id }
    } catch {
      return { message: text.slice(0, 200) }
    }
  } catch {
    return { message: fallback }
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Attach the stored bearer token (default true). */
  auth?: boolean
  /** Retry on network errors / 502-504 (default: GET only). */
  retry?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const retry = opts.retry ?? method === 'GET'
  const attempts = retry ? RETRY_DELAYS_MS.length + 1 : 1
  const useAuth = opts.auth ?? true

  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    const token = useAuth ? tokenStorage.get() : null
    if (token) headers.Authorization = `Bearer ${token}`

    const slowTimer = setTimeout(() => markSlow(+1), SLOW_THRESHOLD_MS)
    let slowMarked = false
    const settle = () => {
      clearTimeout(slowTimer)
      if (slowMarked) markSlow(-1)
    }
    const slowCheck = setTimeout(() => {
      slowMarked = true
    }, SLOW_THRESHOLD_MS)

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      })
      clearTimeout(slowCheck)
      settle()

      if (RETRYABLE.has(res.status) && attempt < attempts - 1) {
        markSlow(+1)
        await sleep(RETRY_DELAYS_MS[attempt])
        markSlow(-1)
        continue
      }
      if (res.status === 401 && token) unauthorizedEvents.emit()
      if (!res.ok) {
        const { message, requestId } = await parseError(res)
        const apiErr = new ApiError(res.status, message, requestId)
        if (res.status >= 500) captureException(apiErr, { path, requestId })
        throw apiErr
      }
      if (res.status === 204) return undefined as T
      return (await res.json()) as T
    } catch (err) {
      clearTimeout(slowCheck)
      settle()
      if (err instanceof ApiError) throw err
      if (attempt < attempts - 1) {
        markSlow(+1)
        await sleep(RETRY_DELAYS_MS[attempt])
        markSlow(-1)
        continue
      }
      throw new NetworkError()
    }
  }
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, name }, auth: false }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  getMe: () => request<User>('/auth/me'),
  getConfig: () => request<AppConfig>('/config', { auth: false }),
  forgotPassword: (email: string) =>
    request<{ status: string; message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token: string, new_password: string) =>
    request<AuthResponse>('/auth/reset-password', { method: 'POST', body: { token, new_password }, auth: false }),
  requestMagicLink: (email: string) =>
    request<{ status: string; message: string }>('/auth/magic-link', { method: 'POST', body: { email }, auth: false }),
  magicSignIn: (token: string) => request<AuthResponse>('/auth/magic', { method: 'POST', body: { token }, auth: false }),
  googleSignIn: (credential: string) => request<AuthResponse>('/auth/google', { method: 'POST', body: { credential }, auth: false }),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: ProjectInput) => request<Project>('/projects', { method: 'POST', body: data }),
  updateProject: (id: number, data: ProjectInput) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Sessions
  getSessions: (projectId?: number, limit = 200) => {
    const q = new URLSearchParams({ limit: String(limit) })
    if (projectId) q.set('project_id', String(projectId))
    return request<Session[]>(`/sessions?${q.toString()}`)
  },
  createSession: (data: SessionInput) => request<Session>('/sessions', { method: 'POST', body: data }),
  deleteSession: (id: number) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (projectId?: number) => request<Task[]>(projectId ? `/tasks?project_id=${projectId}` : '/tasks'),
  createTask: (data: TaskInput) => request<Task>('/tasks', { method: 'POST', body: data }),
  updateTask: (id: number, data: { title: string; estimate_pomodoros: number }) =>
    request<Task>(`/tasks/${id}`, { method: 'PUT', body: data }),
  setTaskDone: (id: number, done: boolean) => request<Task>(`/tasks/${id}/done`, { method: 'PUT', body: { done } }),
  reorderTasks: (ids: number[]) => request<void>('/tasks/order', { method: 'PUT', body: { ids } }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  // Stats (computed in the viewer's timezone)
  getDashboardStats: () => request<DashboardStats>(`/stats/dashboard?tz=${tz()}`),
  getGoals: () => request<GoalsStats>(`/stats/goals?tz=${tz()}`),
  getHeatmap: (days = 365) => request<DailyStat[]>(`/stats/heatmap?tz=${tz()}&days=${days}`),
  getHours: () => request<HourStat[]>(`/stats/hours?tz=${tz()}`),

  // Calendar feed
  createCalendarToken: () => request<CalendarToken>('/auth/calendar-token', { method: 'POST' }),
  revokeCalendarToken: () => request<void>('/auth/calendar-token', { method: 'DELETE' }),
  calendarUrl: (token: string) => `${BASE_URL}/calendar/${token}.ics`,

  // Account
  changePassword: (current_password: string | null, new_password: string) =>
    request<AuthResponse>('/auth/change-password', { method: 'POST', body: { current_password: current_password ?? '', new_password } }),
  deleteAccount: (password: string) => request<void>('/auth/me', { method: 'DELETE', body: { password } }),

  // Import
  importBackup: (payload: unknown) => request<ImportResult>('/import', { method: 'POST', body: payload }),

  // Settings
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (data: Settings) => request<Settings>('/settings', { method: 'POST', body: data }),

  // Feedback
  submitFeedback: (data: FeedbackSubmission) =>
    request<{ status: string; message: string; id: number }>('/feedback', { method: 'POST', body: data }),

  // Export: streams the JSON backup to a download.
  exportBackup: async () => {
    const headers: Record<string, string> = {}
    const token = tokenStorage.get()
    if (token) headers.Authorization = `Bearer ${token}`
    let res: Response
    try {
      res = await fetch(`${BASE_URL}/export`, { headers })
    } catch {
      throw new NetworkError()
    }
    if (res.status === 401) unauthorizedEvents.emit()
    if (!res.ok) {
      const { message, requestId } = await parseError(res)
      throw new ApiError(res.status, message, requestId)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `study_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
