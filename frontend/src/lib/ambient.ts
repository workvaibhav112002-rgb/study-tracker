/**
 * Ambient focus sounds synthesized with the Web Audio API. No audio files:
 * noise generators shaped by filters, so they loop forever without seams.
 */
export type AmbientKind = 'brown' | 'rain' | 'cafe' | 'wind'

export const AMBIENT_OPTIONS: { id: AmbientKind; label: string; hint: string }[] = [
  { id: 'brown', label: 'Brown noise', hint: 'Deep, steady hush' },
  { id: 'rain', label: 'Rain', hint: 'Soft patter on a window' },
  { id: 'wind', label: 'Wind', hint: 'Slow, breathing gusts' },
  { id: 'cafe', label: 'Café', hint: 'Low murmur and clatter' },
]

interface Running {
  kind: AmbientKind
  nodes: AudioNode[]
  gain: GainNode
  timers: number[]
}

function noiseBuffer(ctx: AudioContext, seconds = 4, color: 'white' | 'brown' | 'pink' = 'white'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (color === 'white') d[i] = w
    else if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else {
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11
    }
  }
  return buf
}

export class AmbientPlayer {
  private ctx: AudioContext | null = null
  private running: Running | null = null
  private volume = 0.5

  private context(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  get current(): AmbientKind | null {
    return this.running?.kind ?? null
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.running && this.ctx) this.running.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05)
  }

  stop(): void {
    const r = this.running
    if (!r || !this.ctx) return
    r.timers.forEach((t) => window.clearInterval(t))
    r.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
    const nodes = r.nodes
    window.setTimeout(() => nodes.forEach((n) => { try { (n as AudioScheduledSourceNode).stop?.() } catch { /* already stopped */ } n.disconnect() }), 600)
    this.running = null
  }

  play(kind: AmbientKind): void {
    try {
      if (this.running?.kind === kind) return
      this.stop()
      const ctx = this.context()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.4)
      gain.connect(ctx.destination)
      const nodes: AudioNode[] = [gain]
      const timers: number[] = []
      const loop = (color: 'white' | 'brown' | 'pink') => {
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx, 4, color)
        src.loop = true
        nodes.push(src)
        return src
      }
      if (kind === 'brown') {
        const src = loop('brown')
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 400
        src.connect(lp).connect(gain)
        src.start()
        nodes.push(lp)
      } else if (kind === 'rain') {
        const src = loop('pink')
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 900
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 6000
        src.connect(hp).connect(lp).connect(gain)
        src.start()
        nodes.push(hp, lp)
        // occasional heavier drops
        timers.push(window.setInterval(() => {
          const drop = ctx.createBufferSource()
          drop.buffer = noiseBuffer(ctx, 0.06, 'white')
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.15 + Math.random() * 0.2, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = 2000 + Math.random() * 3000
          drop.connect(bp).connect(g).connect(gain)
          drop.start()
          drop.stop(ctx.currentTime + 0.1)
        }, 180))
      } else if (kind === 'wind') {
        const src = loop('pink')
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 500
        bp.Q.value = 0.6
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.08
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = 350
        lfo.connect(lfoGain).connect(bp.frequency)
        const amp = ctx.createGain()
        amp.gain.value = 0.7
        const lfo2 = ctx.createOscillator()
        lfo2.frequency.value = 0.05
        const lfo2Gain = ctx.createGain()
        lfo2Gain.gain.value = 0.3
        lfo2.connect(lfo2Gain).connect(amp.gain)
        src.connect(bp).connect(amp).connect(gain)
        src.start()
        lfo.start()
        lfo2.start()
        nodes.push(bp, lfo, lfoGain, amp, lfo2, lfo2Gain)
      } else {
        const src = loop('brown')
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 300
        bp.Q.value = 0.4
        const murmur = ctx.createGain()
        murmur.gain.value = 0.6
        src.connect(bp).connect(murmur).connect(gain)
        src.start()
        nodes.push(bp, murmur)
        // clinks and clatter
        timers.push(window.setInterval(() => {
          if (Math.random() < 0.5) return
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = 1800 + Math.random() * 2200
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.03 + Math.random() * 0.04, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.25)
          osc.connect(g).connect(gain)
          osc.start()
          osc.stop(ctx.currentTime + 0.3)
        }, 900))
      }
      this.running = { kind, nodes, gain, timers }
    } catch (err) {
      console.warn('Ambient audio unavailable:', err)
    }
  }
}

export const ambient = new AmbientPlayer()
