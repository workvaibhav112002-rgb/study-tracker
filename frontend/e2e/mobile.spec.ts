import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 375, height: 700 } })

test('the signed-in shell fits a phone without horizontal scroll', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Pause tour' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Start for free' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('Phone User')
  await dialog.getByLabel('Email').fill(`e2e-phone-${Date.now()}@example.test`)
  await dialog.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')

  for (const tab of ['Friends', 'Analytics', 'Focus']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
