/** Client-side sanity check of a backup file before it is sent to /import. */
export interface ImportCheck {
  ok: boolean
  error?: string
  payload?: { projects: unknown[]; sessions: unknown[] }
  counts?: { projects: number; sessions: number }
}

export function validateImport(raw: unknown): ImportCheck {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'The file is not a Study Tracker backup.' }
  const obj = raw as Record<string, unknown>
  const projects = obj.projects
  const sessions = obj.sessions ?? []
  if (!Array.isArray(projects) || projects.length === 0) return { ok: false, error: 'The backup has no projects.' }
  if (!Array.isArray(sessions)) return { ok: false, error: 'The backup sessions are malformed.' }
  for (const p of projects) {
    if (!p || typeof p !== 'object' || typeof (p as { name?: unknown }).name !== 'string') {
      return { ok: false, error: 'A project entry is missing its name.' }
    }
  }
  for (const s of sessions) {
    const x = s as { project_name?: unknown; duration_seconds?: unknown }
    if (!s || typeof s !== 'object' || typeof x.project_name !== 'string' || typeof x.duration_seconds !== 'number') {
      return { ok: false, error: 'A session entry is missing its project or duration.' }
    }
  }
  return { ok: true, payload: { projects, sessions }, counts: { projects: projects.length, sessions: sessions.length } }
}
