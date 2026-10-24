import type { DashboardStats } from '../types'

export interface ShareCardData {
  title: string
  streakDays: number
  weekMinutes: number
  totalMinutes: number
  pomodoros: number
  topProject?: { name: string; color: string }
  appUrl: string
}

export function shareDataFromStats(stats: DashboardStats, appUrl: string): ShareCardData {
  const top = stats.project_stats[0]
  return {
    title: 'My study week',
    streakDays: stats.current_streak_days,
    weekMinutes: stats.weekly_minutes,
    totalMinutes: stats.total_minutes,
    pomodoros: stats.completed_pomodoros,
    topProject: top ? { name: top.name, color: top.color } : undefined,
    appUrl,
  }
}

const fmt = (m: number) => {
  const h = Math.floor(m / 60)
  const r = m % 60
  return h ? `${h}h ${r}m` : `${r}m`
}

/** Renders a 1200×630 share image onto a canvas. Returns null without a 2D context. */
export function renderShareCard(canvas: HTMLCanvasElement, d: ShareCardData): boolean {
  const W = 1200
  const H = 630
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0b0d13')
  bg.addColorStop(1, '#07080c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(180, 80, 10, 180, 80, 520)
  glow.addColorStop(0, 'rgba(16,185,129,0.22)')
  glow.addColorStop(1, 'rgba(16,185,129,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, 0, W, 2)

  const font = (weight: number, size: number, mono = false) => `${weight} ${size}px ${mono ? '"Geist Mono", ui-monospace, monospace' : 'Geist, Inter, system-ui, sans-serif'}`
  ctx.fillStyle = '#6b7388'
  ctx.font = font(600, 22)
  ctx.letterSpacing = '4px'
  ctx.fillText('STUDY TRACKER', 80, 90)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#f5f6f8'
  ctx.font = font(600, 56)
  ctx.fillText(d.title, 80, 170)

  const tiles: { label: string; value: string }[] = [
    { label: 'STREAK', value: `${d.streakDays} day${d.streakDays === 1 ? '' : 's'}` },
    { label: 'LAST 7 DAYS', value: fmt(d.weekMinutes) },
    { label: 'ALL TIME', value: fmt(d.totalMinutes) },
    { label: 'POMODOROS', value: String(d.pomodoros) },
  ]
  const tileW = 250
  tiles.forEach((t, i) => {
    const x = 80 + i * (tileW + 20)
    const y = 230
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    roundRect(ctx, x, y, tileW, 150, 24)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, tileW, 150, 24)
    ctx.stroke()
    ctx.fillStyle = '#6b7388'
    ctx.font = font(600, 18)
    ctx.letterSpacing = '3px'
    ctx.fillText(t.label, x + 28, y + 48)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = '#f5f6f8'
    ctx.font = font(600, 44, true)
    ctx.fillText(t.value, x + 28, y + 112)
  })

  if (d.topProject) {
    ctx.fillStyle = d.topProject.color
    ctx.beginPath()
    ctx.arc(92, 466, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b4bac8'
    ctx.font = font(500, 26)
    ctx.fillText(`Mostly ${d.topProject.name}`, 116, 475)
  }

  ctx.fillStyle = '#34d399'
  ctx.font = font(600, 24)
  ctx.fillText(d.appUrl.replace(/^https?:\/\//, ''), 80, 560)
  return true
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Shares via the Web Share API when files are supported, else downloads. */
export async function shareOrDownload(canvas: HTMLCanvasElement, filename = 'study-week.png'): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return 'failed'
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My study week' })
      return 'shared'
    } catch {
      /* user cancelled or unsupported; fall through */
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
