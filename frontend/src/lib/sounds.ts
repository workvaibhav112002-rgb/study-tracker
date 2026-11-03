/**
 * End-of-interval sounds, synthesized with Web Audio (no audio files).
 * A sound is a list of voices; `schedule()` turns one into timed notes,
 * applying volume and gentle mode so the player stays trivial and testable.
 */
export type SoundId = 'chime' | 'soft' | 'bell' | 'gong' | 'marimba' | 'digital' | 'rise' | 'none'

export interface Voice {
  /** Seconds after the start of the sound. */
  at: number
  freq: number
  wave: OscillatorType
  /** Peak gain before volume, 0..1. */
  gain: number
  attack: number
  decay: number
  /** Optional pitch glide target (Hz) over the decay. */
  glideTo?: number
}

export interface SoundDef {
  id: SoundId
  label: string
  voices: Voice[]
}

const arp = (freqs: number[], step: number, wave: OscillatorType, gain: number, decay: number): Voice[] =>
  freqs.map((freq, i) => ({ at: i * step, freq, wave, gain, attack: 0.03, decay }))

// A bell: a fundamental plus inharmonic partials that die away faster.
const bellVoices = (freq: number, at = 0, gain = 0.28): Voice[] => [
  { at, freq, wave: 'sine', gain, attack: 0.004, decay: 2.4 },
  { at, freq: freq * 2.76, wave: 'sine', gain: gain * 0.35, attack: 0.004, decay: 1.1 },
  { at, freq: freq * 5.4, wave: 'sine', gain: gain * 0.15, attack: 0.004, decay: 0.5 },
]

export const SOUNDS: SoundDef[] = [
  { id: 'chime', label: 'Chime', voices: arp([523.25, 659.25, 783.99, 1046.5], 0.12, 'sine', 0.3, 1.2) },
  { id: 'soft', label: 'Soft chime', voices: arp([440, 554.37, 659.25], 0.15, 'triangle', 0.25, 1.5) },
  { id: 'bell', label: 'Bell', voices: [...bellVoices(880), ...bellVoices(1318.5, 0.45, 0.18)] },
  {
    id: 'gong',
    label: 'Gong',
    voices: [
      { at: 0, freq: 110, wave: 'sine', gain: 0.4, attack: 0.02, decay: 3.2 },
      { at: 0, freq: 164.8, wave: 'sine', gain: 0.18, attack: 0.03, decay: 2.6 },
      { at: 0, freq: 296, wave: 'sine', gain: 0.1, attack: 0.05, decay: 1.8 },
    ],
  },
  { id: 'marimba', label: 'Marimba', voices: arp([523.25, 659.25, 783.99, 659.25, 1046.5], 0.11, 'sine', 0.32, 0.35) },
  { id: 'digital', label: 'Digital beep', voices: arp([1760, 1760, 1760], 0.16, 'square', 0.07, 0.09) },
  { id: 'rise', label: 'Gentle rise', voices: arp([392, 493.88, 587.33, 783.99, 987.77], 0.18, 'sine', 0.2, 1.6) },
  { id: 'none', label: 'No sound', voices: [] },
]

export const soundById = (id: SoundId): SoundDef => SOUNDS.find((s) => s.id === id) ?? SOUNDS[0]

/** Length of a sound in seconds (last voice end). */
export const soundLength = (s: SoundDef): number => s.voices.reduce((m, v) => Math.max(m, v.at + v.attack + v.decay), 0)

export interface ScheduledNote extends Voice {
  /** Peak gain after volume and gentle-mode scaling. */
  peak: number
}

/**
 * Notes to play. Volume scales every note (0..1). Gentle mode plays the sound
 * three times, rising from quiet to full, instead of starting suddenly.
 */
export function schedule(s: SoundDef, volume: number, gentle: boolean): ScheduledNote[] {
  const v = Math.max(0, Math.min(1, volume))
  if (v === 0 || s.voices.length === 0) return []
  const passes = gentle ? [0.25, 0.55, 1] : [1]
  const gap = Math.max(0.9, Math.min(1.6, soundLength(s) * 0.8))
  return passes.flatMap((level, p) => s.voices.map((voice) => ({ ...voice, at: voice.at + p * gap, peak: voice.gain * v * level })))
}

/** Vibration patterns (ms on, off, on…) for phones that support it. */
export const VIBRATION = { focus: [220, 120, 220, 120, 400], break: [160, 100, 160] } as const
