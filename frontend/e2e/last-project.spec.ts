import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

test('the timer comes back on the project you picked last', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start for free' }).click()
  const auth = page.getByRole('dialog')
  await auth.getByLabel('Name').fill('Test User')
  await auth.getByLabel('Email').fill(`e2e-last-project-${Date.now()}@example.test`)
  await auth.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await auth.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await createProject(page, 'Writing')
  await createProject(page, 'Coding')

  const nav = page.getByRole('navigation', { name: 'Primary' })
  const picker = page.getByLabel('Project for this session')
  await nav.getByRole('button', { name: 'Focus' }).click()
  await expect(picker.locator('option:checked')).toHaveText('Writing')
  await picker.selectOption({ label: 'Coding' })

  await page.reload()
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(picker.locator('option:checked')).toHaveText('Coding')
})
