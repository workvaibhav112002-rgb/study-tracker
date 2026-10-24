/**
 * Optional error reporting. Sentry is loaded dynamically only when a DSN is
 * configured, so it never ships in the bundle otherwise.
 */
type SentryModule = typeof import('@sentry/react')

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
let sentry: SentryModule | null = null

export async function initMonitoring(): Promise<void> {
  if (!dsn) return
  try {
    const mod = await import('@sentry/react')
    mod.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 })
    sentry = mod
  } catch (err) {
    console.warn('Monitoring disabled:', err)
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  sentry?.captureException(err, context ? { extra: context } : undefined)
}

export function setMonitoringUser(user: { id: number } | null): void {
  sentry?.setUser(user ? { id: String(user.id) } : null)
}
