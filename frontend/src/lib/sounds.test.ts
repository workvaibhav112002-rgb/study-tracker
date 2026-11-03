import { describe, expect, it } from 'vitest'
import { SOUNDS, schedule, soundById, soundLength } from './sounds'

describe('sounds', () => {
  it('has unique ids and real voices for every sound but none', () => {
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length)
    for (const s of SOUNDS) {
      if (s.id === 'none') expect(s.voices).toEqual([])
      else {
        expect(s.voices.length).toBeGreaterThan(0)
        for (const v of s.voices) {
          expect(v.freq).toBeGreaterThan(20)
          expect(v.gain).toBeLessThanOrEqual(0.5)
        }
        expect(soundLength(s)).toBeLessThan(4)
      }
    }
  })
  it('scales by volume and stays silent at zero or for none', () => {
    const chime = soundById('chime')
    const full = schedule(chime, 1, false)
    const half = schedule(chime, 0.5, false)
    expect(full).toHaveLength(chime.voices.length)
    expect(half[0].peak).toBeCloseTo(full[0].peak / 2)
    expect(schedule(chime, 0, false)).toEqual([])
    expect(schedule(soundById('none'), 1, false)).toEqual([])
    expect(schedule(chime, 4, false)[0].peak).toBe(full[0].peak) // clamped
  })
  it('gentle mode repeats three times, quiet to full', () => {
    const bell = soundById('bell')
    const notes = schedule(bell, 1, true)
    expect(notes).toHaveLength(bell.voices.length * 3)
    const firsts = [0, 1, 2].map((p) => notes[p * bell.voices.length])
    expect(firsts[0].peak).toBeLessThan(firsts[1].peak)
    expect(firsts[1].peak).toBeLessThan(firsts[2].peak)
    expect(firsts[1].at).toBeGreaterThan(firsts[0].at)
  })
  it('falls back to the chime for an unknown id', () => {
    expect(soundById('nope' as never).id).toBe('chime')
  })
})
