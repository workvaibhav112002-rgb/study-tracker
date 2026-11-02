import { expect, type Page } from '@playwright/test'

/** New accounts start without projects; create one through the Projects tab. */
export async function createProject(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'New project' }).first().click()
  const form = page.getByRole('dialog', { name: 'New project' })
  await form.getByLabel('Name').fill(name)
  await form.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Project created.')).toBeVisible()
}

/** Switches add-ons on from Settings (they are off for new accounts). */
export async function enableAddons(page: Page, addons: { cards?: boolean; mistakeLab?: boolean }) {
  await page.getByRole('button', { name: 'Timer settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  // The switch is a visually hidden checkbox inside its label; click the label as a user would.
  if (addons.cards) await dialog.locator('label').filter({ hasText: /^Flashcards/ }).click()
  if (addons.mistakeLab) await dialog.locator('label').filter({ hasText: /^Mistake Lab/ }).click()
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Preferences saved.')).toBeVisible()
  if (await dialog.isVisible()) await page.keyboard.press('Escape')
}
