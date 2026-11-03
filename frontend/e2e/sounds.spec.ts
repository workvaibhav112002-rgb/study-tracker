import { expect, test } from '@playwright/test'

test('end-of-interval sound, volume, gentle mode and vibration are chosen per device and remembered', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start for free' }).click()
  const auth = page.getByRole('dialog')
  await auth.getByLabel('Name').fill('Test User')
  await auth.getByLabel('Email').fill(`e2e-sounds-${Date.now()}@example.test`)
  await auth.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await auth.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')

  const open = async () => {
    await page.getByRole('button', { name: 'Timer settings' }).click()
    return page.getByRole('dialog', { name: 'Settings' })
  }
  let dialog = await open()
  const sounds = dialog.getByRole('group', { name: 'Sound choices' })
  await sounds.getByLabel('When a focus session ends', { exact: true }).selectOption('marimba')
  await sounds.getByLabel('When a break ends', { exact: true }).selectOption('none')
  await sounds.getByLabel('Volume').fill('40')
  await expect(sounds.getByText('40%')).toBeVisible()
  await sounds.locator('label').filter({ hasText: /^Gentle mode/ }).click()
  await sounds.getByRole('button', { name: 'Preview: when a focus session ends' }).click()

  // Saved instantly on this device: survives a reload without pressing Save.
  await page.reload()
  dialog = await open()
  const again = dialog.getByRole('group', { name: 'Sound choices' })
  await expect(again.getByLabel('When a focus session ends', { exact: true })).toHaveValue('marimba')
  await expect(again.getByLabel('When a break ends', { exact: true })).toHaveValue('none')
  await expect(again.getByLabel('Volume')).toHaveValue('40')
  await expect(again.locator('label').filter({ hasText: /^Gentle mode/ }).locator('input')).toBeChecked()
  await expect(again.locator('label').filter({ hasText: /^Vibrate/ }).locator('input')).toBeChecked()

  // Turning sound off hides the sound choices.
  await dialog.locator('label').filter({ hasText: /^Sound/ }).first().click()
  await expect(dialog.getByRole('group', { name: 'Sound choices' })).toHaveCount(0)
})
