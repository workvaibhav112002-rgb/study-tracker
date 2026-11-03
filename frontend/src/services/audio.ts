// Web Audio API synthesized sounds (no audio files).
import { schedule, soundById, VIBRATION, type SoundId } from '../lib/sounds'
import { getPrefs } from '../lib/prefs'

class AudioService {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  /** Plays a sound with the given volume (0..1) and gentle mode. */
  play(id: SoundId, volume: number, gentle: boolean) {
    const notes = schedule(soundById(id), volume, gentle)
    if (notes.length === 0) return
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime + 0.02
      for (const n of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const start = now + n.at
        osc.type = n.wave
        osc.frequency.setValueAtTime(n.freq, start)
        if (n.glideTo) osc.frequency.exponentialRampToValueAtTime(n.glideTo, start + n.decay)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(n.peak, start + n.attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.attack + n.decay)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + n.attack + n.decay + 0.05)
      }
    } catch (e) {
      console.warn('Audio playback error:', e)
    }
  }

  /** End of a focus session, using this device's sound preferences. */
  playWorkCompleteChime() {
    const p = getPrefs()
    this.play(p.focus_sound, p.volume, p.gentle_sound)
  }

  /** End of a break, using this device's sound preferences. */
  playBreakCompleteChime() {
    const p = getPrefs()
    this.play(p.break_sound, p.volume, p.gentle_sound)
  }

  /** Vibrates on phones that support it (Android browsers; not iOS). */
  vibrate(kind: keyof typeof VIBRATION) {
    if (!getPrefs().vibrate) return
    try {
      navigator.vibrate?.([...VIBRATION[kind]])
    } catch {
      /* unsupported */
    }
  }

  // Subtle click tick for button presses
  playTick() {
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      gain.gain.setValueAtTime(0.05 * getPrefs().volume, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.06)
    } catch {
      // Ignore: ticks are purely cosmetic
    }
  }
}

export const audioService = new AudioService()

/** True when this browser can vibrate (most Android browsers). */
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
