import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import { initialState } from './timer'
import { TIMER_KEY, clearTimer, loadTimer, saveTimer } from './timerStorage'

describe('timerStorage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips state for the same user only', () => {
    const st = initialState(DEFAULT_SETTINGS)
    saveTimer(7, st)
    expect(loadTimer(7)).toEqual(st)
    expect(loadTimer(8)).toBeNull()
    clearTimer()
    expect(loadTimer(7)).toBeNull()
  })

  it('rejects corrupt or foreign payloads', () => {
    localStorage.setItem(TIMER_KEY, '{not json')
    expect(loadTimer(1)).toBeNull()
    localStorage.setItem(TIMER_KEY, JSON.stringify({ v: 2, userId: 1, state: initialState(DEFAULT_SETTINGS) }))
    expect(loadTimer(1)).toBeNull()
    localStorage.setItem(TIMER_KEY, JSON.stringify({ v: 1, userId: 1, state: { mode: 'work' } }))
    expect(loadTimer(1)).toBeNull()
  })

  it('swallows storage failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveTimer(1, initialState(DEFAULT_SETTINGS))).not.toThrow()
  })
})
