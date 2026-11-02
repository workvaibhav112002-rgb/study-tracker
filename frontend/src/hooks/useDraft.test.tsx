import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { clearAllDrafts, clearDraft, readDraft, useDraftAutosave } from './useDraft'

const isObj = (v: unknown): v is { a: number } => typeof v === 'object' && v !== null && typeof (v as { a: unknown }).a === 'number'

describe('drafts', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('saves after the value settles and reads it back', () => {
    const { rerender } = renderHook(({ v }) => useDraftAutosave('k', v, true), { initialProps: { v: { a: 1 } } })
    rerender({ v: { a: 2 } })
    expect(readDraft('k', isObj)).toBeNull()
    vi.advanceTimersByTime(500)
    expect(readDraft('k', isObj)).toEqual({ a: 2 })
    clearDraft('k')
    expect(readDraft('k', isObj)).toBeNull()
  })

  it('does not save while disabled and saves on page hide', () => {
    const { rerender } = renderHook(({ v, on }) => useDraftAutosave('k2', v, on), { initialProps: { v: { a: 1 }, on: false } })
    vi.advanceTimersByTime(500)
    expect(readDraft('k2', isObj)).toBeNull()
    rerender({ v: { a: 3 }, on: true })
    window.dispatchEvent(new Event('pagehide'))
    expect(readDraft('k2', isObj)).toEqual({ a: 3 })
  })

  it('rejects malformed drafts and clears all', () => {
    localStorage.setItem('study_tracker_draft_v1:bad', '{"a":"x"}')
    localStorage.setItem('study_tracker_draft_v1:broken', '{')
    localStorage.setItem('other', '1')
    expect(readDraft('bad', isObj)).toBeNull()
    expect(readDraft('broken', isObj)).toBeNull()
    clearAllDrafts()
    expect(localStorage.getItem('study_tracker_draft_v1:bad')).toBeNull()
    expect(localStorage.getItem('other')).toBe('1')
  })
})
