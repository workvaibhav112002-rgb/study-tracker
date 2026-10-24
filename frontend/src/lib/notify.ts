/** Thin, safe wrapper over the Notification API. Every call is a no-op where unsupported. */

export type Permission = NotificationPermission | 'unsupported'

export function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permission(): Permission {
  return supportsNotifications() ? Notification.permission : 'unsupported'
}

/** Must be invoked from a user gesture to be honoured by browsers. */
export async function requestPermission(): Promise<Permission> {
  if (!supportsNotifications()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function notify(title: string, body: string, tag = 'study-tracker-timer'): void {
  if (permission() !== 'granted') return
  try {
    const n = new Notification(title, { body, tag, icon: '/icons/icon-192.png', silent: false })
    window.setTimeout(() => n.close(), 8000)
  } catch {
    /* some browsers throw outside a service worker; ignore */
  }
}
