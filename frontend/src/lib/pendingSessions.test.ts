import { describe, expect, it } from 'vitest'
import type { SessionInput } from '../types'
import { enqueue, flushPending, listPending, sessionKey } from './pendingSessions'

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const input = (start: string, project = 1): SessionInput => ({
  project_id: project, start_time: start, end_time: start, duration_seconds: 1500, session_type: 'pomodoro', focus_rating: 3, notes: '', interruptions: 0, task_id: null,
})

describe('pending sessions', () => {
  it('queues per user without duplicates', () => {
    const kv = mem()
    enqueue(1, input('2026-11-04T09:00:00Z'), kv)
    enqueue(1, input('2026-11-04T09:00:00Z'), kv)
    enqueue(1, input('2026-11-04T10:00:00Z'), kv)
    enqueue(2, input('2026-11-04T09:00:00Z'), kv)
    expect(listPending(1, kv)).toHaveLength(2)
    expect(listPending(2, kv)).toHaveLength(1)
    expect(sessionKey(input('2026-11-04T09:00:00Z'))).toBe('1:2026-11-04T09:00:00Z:1500')
  })
  it('keeps items on network errors, drops permanent rejections', async () => {
    const kv = mem()
    enqueue(1, input('2026-11-04T09:00:00Z'), kv)
    enqueue(1, input('2026-11-04T10:00:00Z', 2), kv)
    enqueue(1, input('2026-11-04T11:00:00Z', 3), kv)
    const offline = await flushPending(1, () => Promise.reject(new Error('offline')), () => false, kv)
    expect(offline).toMatchObject({ saved: [], dropped: [], waiting: 3 })
    const mixed = await flushPending(
      1,
      (s) => (s.project_id === 2 ? Promise.reject({ status: 400 }) : s.project_id === 3 ? Promise.reject(new Error('503')) : Promise.resolve({ id: 9 })),
      (e) => (e as { status?: number }).status === 400,
      kv,
    )
    expect(mixed.saved.map((x) => x.value)).toEqual([{ id: 9 }])
    expect(mixed.dropped.map((x) => x.item.input.project_id)).toEqual([2])
    expect(mixed.waiting).toBe(1)
    expect(listPending(1, kv).map((p) => p.input.project_id)).toEqual([3])
  })
  it('survives corrupt storage', () => {
    const kv = mem()
    kv.setItem('study_tracker_pending_sessions_v1:1', '{not json')
    expect(listPending(1, kv)).toEqual([])
  })
})
