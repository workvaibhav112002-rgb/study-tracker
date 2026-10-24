import { describe, expect, it } from 'vitest'
import { currentSubscription, subscribePush, supportsPush, toPushKeys, unsubscribePush, urlBase64ToUint8Array } from './push'

describe('push', () => {
  it('decodes base64url keys', () => {
    // "hello" in base64url with padding stripped.
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111])
    // URL-safe characters map back to standard base64.
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255])
  })

  it('serialises a subscription and rejects incomplete ones', () => {
    const good = { toJSON: () => ({ endpoint: 'https://p/e', keys: { p256dh: 'k', auth: 'a' } }) } as unknown as PushSubscription
    expect(toPushKeys(good)).toEqual({ endpoint: 'https://p/e', keys: { p256dh: 'k', auth: 'a' } })
    const bad = { toJSON: () => ({ endpoint: 'https://p/e', keys: { p256dh: 'k' } }) } as unknown as PushSubscription
    expect(toPushKeys(bad)).toBeNull()
  })

  it('is a no-op without platform support', async () => {
    expect(supportsPush()).toBe(false)
    expect(await currentSubscription()).toBeNull()
    expect(await subscribePush('abc')).toBeNull()
    expect(await unsubscribePush()).toBeNull()
  })
})
