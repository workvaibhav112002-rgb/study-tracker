import { DashboardStats, Project, Session, Settings } from '../types'

const BASE_URL = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(errorText || `Request failed with status ${res.status}`)
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

export const api = {
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
}
