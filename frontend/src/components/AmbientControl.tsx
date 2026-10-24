import React, { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { AMBIENT_OPTIONS, ambient, type AmbientKind } from '../lib/ambient'

const KEY = 'study_tracker_ambient_v1'

function load(): { kind: AmbientKind | null; volume: number } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { kind: null, ...(JSON.parse(raw) as { volume?: number }), volume: Math.min(1, Math.max(0, (JSON.parse(raw) as { volume?: number }).volume ?? 0.5)) }
  } catch {
    /* ignore */
  }
  return { kind: null, volume: 0.5 }
}

/** Ambient sound picker shown under the timer. Never auto-plays. */
export const AmbientControl: React.FC = () => {
  const [{ volume }, setPrefs] = useState(load)
  const [kind, setKind] = useState<AmbientKind | null>(null)

  useEffect(() => {
    ambient.setVolume(volume)
    try {
      localStorage.setItem(KEY, JSON.stringify({ volume }))
    } catch {
      /* ignore */
    }
  }, [volume])

  useEffect(() => () => ambient.stop(), [])

  const pick = (k: AmbientKind) => {
    if (kind === k) {
      ambient.stop()
      setKind(null)
    } else {
      ambient.play(k)
      setKind(k)
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Ambient sound">
      {AMBIENT_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={kind === o.id}
          title={o.hint}
          onClick={() => pick(o.id)}
          className={`focus-ring chip transition ${kind === o.id ? 'border-brand-500/30 bg-brand-500/15 text-brand-300' : 'border-white/[0.06] bg-white/[0.04] text-ink-400 hover:text-ink-100'}`}
        >
          {kind === o.id ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />}
          {o.label}
        </button>
      ))}
      {kind && (
        <label className="flex items-center gap-2 text-[11px] text-ink-500">
          <span className="sr-only">Ambient volume</span>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setPrefs({ kind, volume: Number(e.target.value) })} className="h-1 w-24 accent-emerald-400" aria-label="Ambient volume" />
        </label>
      )}
    </div>
  )
}
