import { expect, test } from '@playwright/test'

const email = `e2e-${Date.now()}@example.test`
const password = 'e2e-password-123'

test('register, run a timer, log a session, see analytics', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Study with intent')

  await page.getByRole('button', { name: 'Start for free' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('E2E User')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Create account' }).click()

  // Signed in: seed projects exist and the timer is ready.
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await expect(page.getByLabel('Project for this session')).toContainText('Go Programming')

  // Timer runs, survives a reload, and can be paused.
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('timer')).not.toHaveText('25:00', { timeout: 5_000 })
  await page.reload()
  await expect(page.getByText('Running')).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText('Paused')).toBeVisible()

  // Log a manual session and see it in history and analytics.
  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('button', { name: 'Log session', exact: true }).click()
  const log = page.getByRole('dialog', { name: 'Log a session' })
  await log.getByLabel('Duration (minutes)').fill('30')
  await log.getByRole('button', { name: 'Add entry' }).click()
  await expect(page.getByText('Session logged.')).toBeVisible()
  await expect(page.locator('table')).toContainText('30m')

  await page.getByRole('button', { name: 'Analytics' }).click()
  await expect(page.getByText('Today', { exact: true })).toBeVisible()
  await expect(page.getByText('30m').first()).toBeVisible()

  // Sign out returns to the landing page.
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Start for free' })).toBeVisible()
})
