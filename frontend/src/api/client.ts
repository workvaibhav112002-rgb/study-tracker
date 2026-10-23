import { AuthResponse, DashboardStats, Project, Session, Settings, User } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api'
const TOKEN_KEY = 'study_tracker_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`
    try {
      const errJson = await res.json()
      if (errJson.error) errorMsg = errJson.error
    } catch {
      const text = await res.text().catch(() => '')
      if (text) errorMsg = text
    }
    throw new Error(errorMsg)
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<User>('/auth/me'),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: Partial<Project>) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Sessions
  getSessions: (projectId?: number, limit = 100) => {
    const query = new URLSearchParams()
    if (projectId) query.set('project_id', projectId.toString())
    if (limit) query.set('limit', limit.toString())
    return request<Session[]>(`/sessions?${query.toString()}`)
  },
  createSession: (data: Omit<Session, 'id' | 'created_at'>) =>
    request<Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  deleteSession: (id: number) =>
    request<void>(`/sessions/${id}`, { method: 'DELETE' }),

  // Stats
  getDashboardStats: () => request<DashboardStats>('/stats/dashboard'),

  // Settings
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (data: Settings) =>
    request<Settings>('/settings', { method: 'POST', body: JSON.stringify(data) }),

  // Export
  exportUrl: `${BASE_URL}/export`,

  // Feedback
  submitFeedback: (data: { type: string; message: string; email?: string }) =>
    request<{ status: string; message: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
