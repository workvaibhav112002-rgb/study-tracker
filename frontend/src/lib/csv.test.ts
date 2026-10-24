import { describe, expect, it } from 'vitest'
import { parseCsv, sessionsFromCsv } from './csv'

describe('parseCsv', () => {
  it('handles quotes, embedded commas and newlines, CRLF and a BOM', () => {
    const text = '﻿a,b\r\n"x, y","line1\nline2"\r\n"he said ""hi""",plain\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
      ['he said "hi"', 'plain'],
    ])
  })
  it('drops blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n   ,\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('sessionsFromCsv', () => {
  it('maps the app export format back to an import payload', () => {
    const csv = ['project,start_time,end_time,duration_minutes,session_type,focus_rating,interruptions,notes', 'Maths,2026-02-03T09:35:00+05:30,2026-02-03T10:00:00+05:30,25,pomodoro,4,1,"deep, work"', 'Maths,2026-02-04T09:35:00Z,,30,manual,,,'].join('\n')
    const r = sessionsFromCsv(csv)
    expect(r.ok).toBe(true)
    expect(r.counts).toEqual({ projects: 1, sessions: 2, skipped: 0 })
    const s = r.payload!.sessions[0]
    expect(s.project_name).toBe('Maths')
    expect(s.start_time).toBe('2026-02-03T04:05:00.000Z')
    expect(s.duration_seconds).toBe(1500)
    expect(s.session_type).toBe('pomodoro')
    expect(s.focus_rating).toBe(4)
    expect(s.interruptions).toBe(1)
    expect(s.notes).toBe('deep, work')
    const t = r.payload!.sessions[1]
    expect(t.end_time).toBe('2026-02-04T10:05:00.000Z')
    expect(t.focus_rating).toBe(3)
    expect(t.session_type).toBe('manual')
  })

  it('accepts loose headers from other apps and derives duration from end time', () => {
    const csv = 'Subject,Date,End,Rating\nPhysics,2026-01-10T08:00:00Z,2026-01-10T08:45:00Z,5\nChemistry,bad date,,\n'
    const r = sessionsFromCsv(csv)
    expect(r.ok).toBe(true)
    expect(r.counts).toEqual({ projects: 1, sessions: 1, skipped: 1 })
    expect(r.payload!.sessions[0].duration_seconds).toBe(2700)
    expect(r.payload!.projects[0].name).toBe('Physics')
  })

  it('explains missing columns', () => {
    expect(sessionsFromCsv('a,b\n1,2').error).toMatch(/project/)
    expect(sessionsFromCsv('project,minutes\nX,5').error).toMatch(/start_time/)
    expect(sessionsFromCsv('project,start\nX,2026-01-01').error).toMatch(/duration/)
    expect(sessionsFromCsv('project').ok).toBe(false)
  })
})
