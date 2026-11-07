import { expect, test, type Page } from '@playwright/test'
import { createProject } from './helpers'

async function signUpWithOneMinuteFocus(page: Page, tag: string) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Start for free' }).click()
  const auth = page.getByRole('dialog')
  await auth.getByLabel('Name').fill('Test User')
  await auth.getByLabel('Email').fill(`e2e-${tag}-${Date.now()}@example.test`)
  await auth.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await auth.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await createProject(page, 'Writing')
  // One-minute focus sessions keep the test fast.
  await page.getByRole('button', { name: 'Timer settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('spinbutton', { name: 'Focus', exact: true }).fill('1')
  await settings.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Preferences saved.')).toBeVisible()
  if (await settings.isVisible()) await page.keyboard.press('Escape')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Focus' }).click()
}

async function runOneSession(page: Page) {
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.clock.fastForward('01:05')
}

test('a finished session saves itself; rate, note and undo from the card', async ({ page }) => {
  await signUpWithOneMinuteFocus(page, 'autosave')
  await runOneSession(page)

  const card = page.getByTestId('saved-session-card')
  await expect(card).toContainText('Saved 1m to Writing')
  await expect(page.getByRole('dialog')).toHaveCount(0) // no rating dialog
  await card.getByRole('radio', { name: '5 stars' }).click()
  await card.getByRole('button', { name: 'Add note' }).click()
  await card.getByLabel('Session note').fill('Outlined chapter two')
  await card.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Note added.')).toBeVisible()

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'History' }).click()
  await expect(page.locator('table')).toContainText('Outlined chapter two')
  // The rating given on the card is stored too.
  await expect(page.locator('table tbody tr').first().getByRole('img', { name: '5 out of 5' })).toHaveCount(1)
})

test('offline: the session waits on the device and syncs when back online', async ({ page, context }) => {
  await signUpWithOneMinuteFocus(page, 'autosave-offline')
  await context.setOffline(true)
  await runOneSession(page)
  const card = page.getByTestId('saved-session-card')
  await expect(card).toContainText('Saved on this device')
  await expect(card).toContainText('sync as soon as you are back online')
  await context.setOffline(false)
  await expect(card).toContainText('Saved 1m to Writing', { timeout: 15_000 })
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'History' }).click()
  await expect(page.locator('table tbody tr')).toHaveCount(1)
})

test('undo removes the auto-saved session, and the dialog comes back when asked for', async ({ page }) => {
  await signUpWithOneMinuteFocus(page, 'autosave-undo')
  await runOneSession(page)
  const card = page.getByTestId('saved-session-card')
  await expect(card).toContainText('Saved 1m to Writing')
  await card.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Session removed.')).toBeVisible()
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'History' }).click()
  await expect(page.locator('table tbody tr')).toHaveCount(0)

  // Opt back into the rating dialog.
  await page.getByRole('button', { name: 'Timer settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.locator('label').filter({ hasText: /^Ask me to rate each session/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Focus' }).click()
  // Skip the break to get back to a focus interval.
  await page.getByRole('button', { name: /Skip/ }).first().click()
  await runOneSession(page)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('saved-session-card')).toHaveCount(0)
})

test('notes and rating can be edited later from History', async ({ page }) => {
  await signUpWithOneMinuteFocus(page, 'history-edit')
  await runOneSession(page)
  await expect(page.getByTestId('saved-session-card')).toContainText('Saved 1m to Writing')

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'History' }).click()
  const row = page.locator('table tbody tr').first()
  await row.getByRole('button', { name: /Edit session from/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit session' })
  await dialog.getByRole('radio', { name: '2 stars' }).click()
  await dialog.getByLabel('Notes').fill('Phone kept buzzing; try airplane mode')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Session updated.')).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(row).toContainText('Phone kept buzzing; try airplane mode')
  await expect(row.getByRole('img', { name: '2 out of 5' })).toHaveCount(1)

  // The edit is stored on the server, not only on screen.
  await page.reload()
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'History' }).click()
  await expect(page.locator('table tbody tr').first()).toContainText('Phone kept buzzing; try airplane mode')

  // Clicking the note itself opens the editor too; clearing it works.
  await page.locator('table tbody tr').first().getByRole('button', { name: /Edit note:/ }).click()
  await dialog.getByLabel('Notes').fill('')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('table tbody tr').first().getByRole('button', { name: /Add a note/ })).toBeVisible()
})
