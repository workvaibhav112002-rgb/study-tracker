/**
 * Native-app bridge (Capacitor). Everything here is a no-op in the browser,
 * so web behaviour is unchanged; plugins load lazily inside the app only.
 */
import { Capacitor } from '@capacitor/core'

export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

const TIMER_NOTIFICATION_ID = 4242

export type TimerKind = 'work' | 'short_break' | 'long_break'

/** Title and body of the "interval done" notification. */
export function timerDoneMessage(kind: TimerKind): { title: string; body: string } {
  return kind === 'work'
    ? { title: 'Focus session done', body: 'Nice work. Open Granule to rate it and log it.' }
    : { title: 'Break over', body: 'Back to it when you are ready.' }
}

let permissionAsked = false

/**
 * Schedules the end-of-interval notification so it fires even if the app is
 * closed or the phone is locked. Replaces any earlier one.
 */
export async function scheduleTimerDone(atMs: number, kind: TimerKind): Promise<void> {
  if (!isNativeApp() || atMs <= Date.now()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  if (!permissionAsked) {
    permissionAsked = true
    const p = await LocalNotifications.checkPermissions()
    if (p.display !== 'granted') await LocalNotifications.requestPermissions()
  }
  await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] })
  const { title, body } = timerDoneMessage(kind)
  await LocalNotifications.schedule({
    notifications: [{ id: TIMER_NOTIFICATION_ID, title, body, schedule: { at: new Date(atMs), allowWhileIdle: true } }],
  })
}

export async function cancelTimerDone(): Promise<void> {
  if (!isNativeApp()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] })
}

/** Phone vibration through the native haptics engine (works on iPhone too). */
export async function nativeVibrate(pattern: readonly number[]): Promise<boolean> {
  if (!isNativeApp()) return false
  const { Haptics } = await import('@capacitor/haptics')
  // Pulse once per "on" segment of the pattern.
  for (let i = 0; i < pattern.length; i += 2) {
    await Haptics.vibrate({ duration: pattern[i] })
    if (i + 1 < pattern.length) await new Promise((r) => setTimeout(r, pattern[i] + pattern[i + 1]))
  }
  return true
}

/** Keeps the screen on while a session runs. */
export async function nativeKeepAwake(on: boolean): Promise<boolean> {
  if (!isNativeApp()) return false
  const { KeepAwake } = await import('@capacitor-community/keep-awake')
  if (on) await KeepAwake.keepAwake()
  else await KeepAwake.allowSleep()
  return true
}

/** Android back button: go back a tab instead of closing the app. */
export async function onNativeBack(handler: () => boolean): Promise<() => void> {
  if (!isNativeApp()) return () => undefined
  const { App } = await import('@capacitor/app')
  const sub = await App.addListener('backButton', () => {
    if (!handler()) void App.minimizeApp()
  })
  return () => void sub.remove()
}
