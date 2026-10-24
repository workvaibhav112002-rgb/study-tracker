/**
 * CSV parsing (RFC 4180: quoted fields, doubled quotes, CRLF) and a mapper
 * that turns a spreadsheet of sessions into the /import payload. Pure, so it
 * is unit-testable and can run on files from other apps.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.startsWith('﻿') ? text.slice(1) : text
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface CsvSession {
  project_name: string
  start_time: string
  end_time: string
  duration_seconds: number
  session_type: 'pomodoro' | 'custom' | 'manual'
  focus_rating: number
  notes: string
  interruptions: number
}

export interface CsvImport {
  ok: boolean
  error?: string
  payload?: { projects: { name: string; color: string; description: string; target_minutes_per_day: number }[]; sessions: CsvSession[] }
  counts?: { projects: number; sessions: number; skipped: number }
}

const COLUMNS: Record<keyof CsvSession | 'duration_minutes', string[]> = {
  project_name: ['project', 'project_name', 'subject', 'course', 'name'],
  start_time: ['start_time', 'start', 'started', 'date', 'datetime', 'when'],
  end_time: ['end_time', 'end', 'ended', 'finish'],
  duration_seconds: ['duration_seconds', 'seconds'],
  duration_minutes: ['duration_minutes', 'minutes', 'duration', 'mins', 'length'],
  session_type: ['session_type', 'type'],
  focus_rating: ['focus_rating', 'rating', 'focus', 'score'],
  notes: ['notes', 'note', 'comment', 'comments', 'description'],
  interruptions: ['interruptions', 'interrupts', 'distractions'],
}

const PALETTE = ['#10b981', '#38bdf8', '#a78bfa', '#f59e0b', '#f43f5e', '#f97316', '#22d3ee', '#84cc16']

function findColumns(header: string[]): Partial<Record<keyof typeof COLUMNS, number>> {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  const out: Partial<Record<keyof typeof COLUMNS, number>> = {}
  for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
    const idx = norm.findIndex((h) => COLUMNS[key].includes(h))
    if (idx >= 0) out[key] = idx
  }
  return out
}

function parseWhen(raw: string): Date | null {
  const t = raw.trim()
  if (!t) return null
  // Date-only values are taken as local noon so they land on the right day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(t + 'T12:00:00') : new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Maps CSV rows onto sessions; rows without a project or usable duration are skipped. */
export function sessionsFromCsv(text: string): CsvImport {
  const rows = parseCsv(text)
  if (rows.length < 2) return { ok: false, error: 'The CSV needs a header row and at least one session.' }
  const cols = findColumns(rows[0])
  if (cols.project_name === undefined) return { ok: false, error: 'No "project" column found. Expected columns: project, start_time, duration_minutes (optional: end_time, session_type, focus_rating, interruptions, notes).' }
  if (cols.start_time === undefined) return { ok: false, error: 'No "start_time" (or "date") column found.' }
  if (cols.duration_minutes === undefined && cols.duration_seconds === undefined && cols.end_time === undefined) {
    return { ok: false, error: 'Need a "duration_minutes" or "end_time" column.' }
  }
  const sessions: CsvSession[] = []
  const names = new Map<string, number>()
  let skipped = 0
  const cell = (r: string[], k: keyof typeof COLUMNS) => (cols[k] === undefined ? '' : (r[cols[k]!] ?? '').trim())
  for (const r of rows.slice(1)) {
    const name = cell(r, 'project_name').slice(0, 100)
    const start = parseWhen(cell(r, 'start_time'))
    if (!name || !start) {
      skipped++
      continue
    }
    let seconds = 0
    if (cols.duration_seconds !== undefined) seconds = Math.round(Number(cell(r, 'duration_seconds')))
    else if (cols.duration_minutes !== undefined) seconds = Math.round(Number(cell(r, 'duration_minutes')) * 60)
    let end = cols.end_time !== undefined ? parseWhen(cell(r, 'end_time')) : null
    if (!seconds && end) seconds = Math.round((end.getTime() - start.getTime()) / 1000)
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 24 * 3600) {
      skipped++
      continue
    }
    if (!end) end = new Date(start.getTime() + seconds * 1000)
    const rawType = cell(r, 'session_type').toLowerCase()
    const session_type: CsvSession['session_type'] = rawType === 'pomodoro' || rawType === 'custom' ? rawType : 'manual'
    const rating = Math.round(Number(cell(r, 'focus_rating')))
    const interruptions = Math.round(Number(cell(r, 'interruptions')))
    if (!names.has(name)) names.set(name, names.size)
    sessions.push({
      project_name: name,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_seconds: seconds,
      session_type,
      focus_rating: rating >= 1 && rating <= 5 ? rating : 3,
      notes: cell(r, 'notes').slice(0, 2000),
      interruptions: interruptions >= 0 && interruptions <= 100 ? interruptions : 0,
    })
  }
  if (sessions.length === 0) return { ok: false, error: `No usable rows (${skipped} skipped). Check the project, start and duration columns.` }
  const projects = [...names.keys()].map((name, i) => ({ name, color: PALETTE[i % PALETTE.length], description: '', target_minutes_per_day: 60 }))
  if (projects.length > 200) return { ok: false, error: 'Imports are limited to 200 projects.' }
  return { ok: true, payload: { projects, sessions }, counts: { projects: projects.length, sessions: sessions.length, skipped } }
}
