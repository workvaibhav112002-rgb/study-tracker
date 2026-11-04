/**
 * Sessions waiting to reach the server. A finished session is queued on the
 * device first, then sent; it leaves the queue only once the server confirms
 * it (or rejects it as invalid). The server treats a resend of the same
 * session as the same row, so retries never create duplicates.
 */
import type { SessionInput } from '../types'

export interface PendingSession {
  key: string
  input: SessionInput
  queuedAt: string
}

const PREFIX = 'study_tracker_pending_sessions_v1:'

export interface KVStore {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

const store = (): KVStore | null => {
  try {
    return localStorage
  } catch {
    return null
  }
}

export const sessionKey = (s: SessionInput) => `${s.project_id}:${s.start_time}:${s.duration_seconds}`

export function listPending(userId: number, kv: KVStore | null = store()): PendingSession[] {
  try {
    const raw = kv?.getItem(PREFIX + userId)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? (v as PendingSession[]).filter((p) => p && typeof p.key === 'string' && p.input) : []
  } catch {
    return []
  }
}

function save(userId: number, list: PendingSession[], kv: KVStore | null) {
  try {
    kv?.setItem(PREFIX + userId, JSON.stringify(list))
  } catch {
    /* storage full or blocked: the in-memory send still happens */
  }
}

export function enqueue(userId: number, input: SessionInput, kv: KVStore | null = store(), now = new Date()): PendingSession {
  const item = { key: sessionKey(input), input, queuedAt: now.toISOString() }
  const list = listPending(userId, kv).filter((p) => p.key !== item.key)
  save(userId, [...list, item], kv)
  return item
}

export function remove(userId: number, key: string, kv: KVStore | null = store()) {
  save(userId, listPending(userId, kv).filter((p) => p.key !== key), kv)
}

export type SendResult<T> = { ok: true; value: T } | { ok: false; retry: boolean; error: unknown }

/**
 * Sends every queued session. Network errors and server errors keep the item
 * for the next try; a 4xx means the session can never be stored, so it is
 * dropped and reported.
 */
export async function flushPending<T>(
  userId: number,
  send: (input: SessionInput) => Promise<T>,
  isPermanent: (err: unknown) => boolean,
  kv: KVStore | null = store(),
): Promise<{ saved: { item: PendingSession; value: T }[]; dropped: { item: PendingSession; error: unknown }[]; waiting: number }> {
  const saved: { item: PendingSession; value: T }[] = []
  const dropped: { item: PendingSession; error: unknown }[] = []
  for (const item of listPending(userId, kv)) {
    try {
      const value = await send(item.input)
      remove(userId, item.key, kv)
      saved.push({ item, value })
    } catch (error) {
      if (isPermanent(error)) {
        remove(userId, item.key, kv)
        dropped.push({ item, error })
      }
    }
  }
  return { saved, dropped, waiting: listPending(userId, kv).length }
}
