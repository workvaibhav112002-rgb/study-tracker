import { defineConfig } from '@playwright/test'

/**
 * End-to-end smoke against a locally built frontend and the real Go API.
 * CI provides API_URL (the Go server) and starts the preview server here.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_API_URL: process.env.API_URL ?? 'http://localhost:8080' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
