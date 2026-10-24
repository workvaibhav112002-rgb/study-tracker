import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const vercel = JSON.parse(readFileSync(path.join(here, '..', 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const csp = vercel.headers.find((h) => h.source === '/(.*)')!.headers.find((h) => h.key === 'Content-Security-Policy')!.value
// These directives are ignored in <meta> delivery and only produce warnings.
const metaCsp = csp
  .split(';')
  .map((d) => d.trim())
  .filter((d) => d && !d.startsWith('frame-ancestors') && !d.startsWith('upgrade-insecure-requests'))
  .join('; ')
  // preview serves the API from localhost in this run
  .replace("connect-src 'self'", "connect-src 'self' http://localhost:8080")

test('the production Content-Security-Policy does not block the app', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) violations.push(m.text())
  })
  await page.route('**/*', async (route) => {
    const res = await route.fetch()
    const ct = res.headers()['content-type'] ?? ''
    if (!ct.includes('text/html')) return route.fulfill({ response: res })
    const html = (await res.text()).replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${metaCsp}">`)
    return route.fulfill({ response: res, body: html, headers: { ...res.headers(), 'content-type': ct } })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Study with intent')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(1500)
  expect(violations, violations.join('\n')).toEqual([])
})
