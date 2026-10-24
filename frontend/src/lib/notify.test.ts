import { afterEach, describe, expect, it, vi } from 'vitest'
import { notify, permission, requestPermission } from './notify'
import { createFavicon } from './favicon'

describe('notify', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('is a no-op without the API', async () => {
    expect(permission()).toBe('unsupported')
    expect(await requestPermission()).toBe('unsupported')
    expect(() => notify('t', 'b')).not.toThrow()
  })
  it('creates a tagged notification when granted', () => {
    const ctor = vi.fn(function (this: { close: () => void }) {
      this.close = vi.fn()
    })
    ;(ctor as unknown as { permission: string }).permission = 'granted'
    vi.stubGlobal('Notification', ctor)
    notify('Done', 'body')
    expect(ctor).toHaveBeenCalledWith('Done', expect.objectContaining({ body: 'body', tag: 'study-tracker-timer' }))
  })
})

describe('favicon', () => {
  it('is a no-op in jsdom and restores the original href', () => {
    const link = document.createElement('link')
    link.id = 'favicon'
    link.href = 'http://localhost/orig.svg'
    document.head.appendChild(link)
    const fav = createFavicon()
    expect(() => fav.update('24:59', 0.1, '#10b981')).not.toThrow()
    fav.restore()
    expect(link.href).toBe('http://localhost/orig.svg')
    link.remove()
  })
})
