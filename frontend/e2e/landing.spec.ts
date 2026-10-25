import { expect, test } from '@playwright/test'

test('the landing page keeps its contracts and the tour respects reduced motion', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Study with intent')
  await expect(page.getByRole('button', { name: 'Start for free' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Pause tour' })).toBeVisible()
  await expect(page.getByText('Example data')).toBeVisible()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.getByText('Example data')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause tour' })).toHaveCount(0)
})

test('a visitor can run the timer, then save it to a brand-new account', async ({ page }) => {
  const email = `e2e-landing-${Date.now()}@example.test`
  await page.clock.install()
  await page.goto('/')

  const demo = page.getByTestId('demo-timer')
  await demo.getByRole('radio', { name: '5 min', exact: true }).click()
  await expect(demo).toContainText('05:00')
  await demo.getByRole('button', { name: 'Start focusing' }).click()
  await page.clock.fastForward(3_000)
  await expect(demo).not.toContainText('05:00')
  await expect(demo).toContainText('Focusing')

  // Run to completion: the save card appears and the timer reads zero.
  await page.clock.fastForward('05:00')
  await expect(demo.getByRole('heading', { name: 'Keep this session' })).toBeVisible()
  await expect(demo).toContainText('00:00')

  await demo.getByRole('button', { name: 'Create account to save' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('Landing User')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await dialog.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('Your landing-page session was saved.')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'History' }).click()
  await expect(page.locator('table')).toContainText('Logged from the landing page')
  await expect(page.locator('table')).toContainText('5m')
})
