/** Draws the remaining time into the favicon while a timer runs. */
export interface FaviconController {
  update(label: string, progress: number, color: string): void
  restore(): void
}

export function createFavicon(doc: Document = document): FaviconController {
  const link = doc.querySelector<HTMLLinkElement>('link#favicon')
  const original = link?.href ?? null
  const canvas = doc.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  let last = ''

  return {
    update(label, progress, color) {
      if (!link || !ctx || label === last) return
      last = label
      ctx.clearRect(0, 0, 64, 64)
      ctx.fillStyle = '#07080c'
      ctx.beginPath()
      ctx.arc(32, 32, 32, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath()
      ctx.arc(32, 32, 27, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(32, 32, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, progress)))
      ctx.stroke()
      ctx.fillStyle = '#f5f6f8'
      ctx.font = 'bold 20px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const text = label.length > 5 ? label.split(':')[0] : label
      ctx.fillText(text, 32, 33)
      try {
        link.href = canvas.toDataURL('image/png')
      } catch {
        /* tainted canvas or unsupported */
      }
    },
    restore() {
      last = ''
      if (link && original !== null) link.href = original
    },
  }
}
