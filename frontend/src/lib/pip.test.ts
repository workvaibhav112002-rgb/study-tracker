import { describe, expect, it } from 'vitest'
import { createPip, drawFrame, supportsPip } from './pip'

describe('pip', () => {
  const frame = { time: '24:59', label: 'Focus', progress: 10, running: true, accent: '#10b981' }
  it('is unsupported in jsdom and never throws', async () => {
    expect(supportsPip()).toBe(false)
    const pip = createPip()
    expect(await pip.open(frame)).toBe(false)
    expect(pip.isOpen()).toBe(false)
    expect(() => pip.update(frame)).not.toThrow()
    await expect(pip.close()).resolves.toBeUndefined()
  })
  it('draws without a 2D context', () => {
    const c = document.createElement('canvas')
    expect(() => drawFrame(c, frame)).not.toThrow()
  })
})
