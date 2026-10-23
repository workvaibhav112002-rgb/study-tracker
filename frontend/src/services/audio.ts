// Web Audio API synthesized sound generator (Zero external MP3 dependencies)

class AudioService {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  // Pleasant bell chime for completing work pomodoro
  playWorkCompleteChime() {
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      const freqs = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 arpeggio
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + index * 0.12)

        gain.gain.setValueAtTime(0, now + index * 0.12)
        gain.gain.linearRampToValueAtTime(0.3, now + index * 0.12 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 1.2)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + index * 0.12)
        osc.stop(now + index * 0.12 + 1.3)
      })
    } catch (e) {
      console.warn('Audio playback error:', e)
    }
  }

  // Calming gong sound for break complete
  playBreakCompleteChime() {
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      const freqs = [440, 554.37, 659.25] // A4, C#5, E5
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + index * 0.15)

        gain.gain.setValueAtTime(0, now + index * 0.15)
        gain.gain.linearRampToValueAtTime(0.25, now + index * 0.15 + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.15 + 1.5)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + index * 0.15)
        osc.stop(now + index * 0.15 + 1.6)
      })
    } catch (e) {
      console.warn('Audio playback error:', e)
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

      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.06)
    } catch (e) {
      // Ignore
    }
  }
}

export const audioService = new AudioService()
