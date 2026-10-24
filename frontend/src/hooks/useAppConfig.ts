import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AppConfig } from '../types'

const FALLBACK: AppConfig = { email_enabled: false, google_client_id: '', app_url: '' }

/** Which optional server features are on. Falls back to "none" on failure. */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(FALLBACK)
  useEffect(() => {
    let cancelled = false
    api
      .getConfig()
      .then((c) => {
        if (!cancelled) setConfig(c)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return config
}
