import { describe, expect, it } from 'vitest'
import { cancelTimerDone, isNativeApp, nativeKeepAwake, nativeVibrate, onNativeBack, scheduleTimerDone, timerDoneMessage } from './native'

describe('native bridge in the browser', () => {
  it('is a no-op on the web', async () => {
    expect(isNativeApp()).toBe(false)
    await expect(scheduleTimerDone(Date.now() + 60_000, 'work')).resolves.toBeUndefined()
    await expect(cancelTimerDone()).resolves.toBeUndefined()
    await expect(nativeVibrate([100, 50, 100])).resolves.toBe(false)
    await expect(nativeKeepAwake(true)).resolves.toBe(false)
    const off = await onNativeBack(() => true)
    expect(typeof off).toBe('function')
  })
  it('words the notification by interval', () => {
    expect(timerDoneMessage('work').title).toBe('Focus session done')
    expect(timerDoneMessage('short_break').title).toBe('Break over')
  })
})
