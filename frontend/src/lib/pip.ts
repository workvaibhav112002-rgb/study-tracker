/**
 * Picture-in-Picture timer: paints the countdown onto a canvas, streams it
 * into a hidden <video>, and asks the browser for a PiP window. Works in
 * Chrome, Edge and Safari; every call is a no-op elsewhere.
 */

export interface PipFrame {
  time: string
  label: string
  progress: number // 0..100
  running: boolean
  accent: string
}

export function supportsPip(): boolean {
  if (typeof document === 'undefined') return false
  const video = document.createElement('video') as HTMLVideoElement & { requestPictureInPicture?: unknown }
  return Boolean(document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function' && 'captureStream' in HTMLCanvasElement.prototype)
}

/** Draws one frame. Exported for tests; safe with a null 2D context. */
export function drawFrame(canvas: HTMLCanvasElement, f: PipFrame): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0b0d14'
  ctx.fillRect(0, 0, w, h)
  // Progress bar along the bottom.
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, h - 8, w, 8)
  ctx.fillStyle = f.accent
  ctx.fillRect(0, h - 8, (w * Math.max(0, Math.min(100, f.progress))) / 100, 8)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `600 ${Math.round(h * 0.11)}px system-ui, sans-serif`
  ctx.fillText(f.label.toUpperCase(), w / 2, h * 0.26)
  ctx.fillStyle = f.running ? '#ffffff' : 'rgba(255,255,255,0.6)'
  ctx.font = `700 ${Math.round(h * 0.42)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.fillText(f.time, w / 2, h * 0.56)
  if (!f.running) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = `500 ${Math.round(h * 0.09)}px system-ui, sans-serif`
    ctx.fillText('paused', w / 2, h * 0.82)
  }
}

export interface PipController {
  open: (frame: PipFrame) => Promise<boolean>
  update: (frame: PipFrame) => void
  close: () => Promise<void>
  isOpen: () => boolean
  /** Fires when the user closes the window from the PiP chrome. */
  onClose: (cb: () => void) => void
}

export function createPip(): PipController {
  let canvas: HTMLCanvasElement | null = null
  let video: HTMLVideoElement | null = null
  let closeCb: () => void = () => undefined
  let open = false
  let last: PipFrame | null = null

  const ensure = () => {
    if (canvas && video) return
    canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 270
    video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.setAttribute('aria-hidden', 'true')
    video.style.position = 'fixed'
    video.style.width = '1px'
    video.style.height = '1px'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
    video.addEventListener('leavepictureinpicture', () => {
      open = false
      closeCb()
    })
    document.body.appendChild(video)
  }

  return {
    async open(frame) {
      if (!supportsPip()) return false
      try {
        ensure()
        last = frame
        drawFrame(canvas!, frame)
        if (!video!.srcObject) video!.srcObject = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(2)
        await video!.play()
        await video!.requestPictureInPicture()
        open = true
        return true
      } catch {
        open = false
        return false
      }
    },
    update(frame) {
      if (!open || !canvas) return
      if (last && last.time === frame.time && last.running === frame.running && last.label === frame.label) return
      last = frame
      drawFrame(canvas, frame)
    },
    async close() {
      if (!open) return
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture()
      } catch {
        /* already closed */
      }
      open = false
    },
    isOpen: () => open,
    onClose(cb) {
      closeCb = cb
    },
  }
}
