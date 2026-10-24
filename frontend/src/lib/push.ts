/**
 * Web Push subscription helpers. Everything is a safe no-op where the
 * platform lacks support (jsdom, iOS Safari without Add-to-Home-Screen).
 */

export interface PushKeys {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function supportsPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Converts a base64url VAPID public key into the bytes `subscribe()` expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Serialises a PushSubscription into the shape the API stores. */
export function toPushKeys(sub: PushSubscription): PushKeys | null {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) return null
  return { endpoint: json.endpoint, keys: { p256dh, auth } }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsPush()) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

/** The browser's current subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  if (!reg) return null
  try {
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** Asks for permission (must run from a user gesture) and subscribes. */
export async function subscribePush(vapidPublicKey: string): Promise<PushKeys | null> {
  const reg = await registration()
  if (!reg) return null
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission !== 'granted') return null
  try {
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource }))
    return toPushKeys(sub)
  } catch {
    return null
  }
}

/** Unsubscribes locally and returns the endpoint that was dropped. */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  try {
    await sub.unsubscribe()
  } catch {
    /* already gone */
  }
  return endpoint
}
