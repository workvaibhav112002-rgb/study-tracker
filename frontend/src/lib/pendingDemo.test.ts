import { afterEach, describe, expect, it } from 'vitest'
import { clearPendingDemo, readPendingDemo, savePendingDemo } from './pendingDemo'

describe('pendingDemo', () => {
  afterEach(() => clearPendingDemo())
  it('round-trips a session and rejects junk', () => {
    expect(readPendingDemo()).toBeNull()
    const s = { startedAt: '2026-03-10T10:00:00.000Z', endedAt: '2026-03-10T10:05:00.000Z', elapsedSeconds: 300 }
    savePendingDemo(s)
    expect(readPendingDemo()).toEqual(s)
    sessionStorage.setItem('study_tracker_demo_session_v1', '{"startedAt":"nope"}')
    expect(readPendingDemo()).toBeNull()
    sessionStorage.setItem('study_tracker_demo_session_v1', 'not json')
    expect(readPendingDemo()).toBeNull()
    clearPendingDemo()
    expect(readPendingDemo()).toBeNull()
  })
})
