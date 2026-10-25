import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

describe('useReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false)
  })

  it('tracks the media query and its change events', () => {
    let matches = true
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return matches
      },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }))
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
    act(() => {
      matches = false
      listeners.forEach((l) => l())
    })
    expect(result.current).toBe(false)
  })
})
