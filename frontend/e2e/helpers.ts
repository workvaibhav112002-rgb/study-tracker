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

/** Sets add-ons from Settings (Flashcards is off and Mistake Lab on for new accounts). */
export async function enableAddons(page: Page, addons: { cards?: boolean; mistakeLab?: boolean }) {
  await page.getByRole('button', { name: 'Timer settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  // Each switch is a visually hidden checkbox inside its label; click the label as a user would.
  for (const [name, want] of [['Flashcards', addons.cards], ['Mistake Lab', addons.mistakeLab]] as const) {
    if (want === undefined) continue
    const label = dialog.locator('label').filter({ hasText: new RegExp(`^${name}`) })
    if ((await label.locator('input').isChecked()) !== want) await label.click()
  }
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Preferences saved.')).toBeVisible()
  if (await dialog.isVisible()) await page.keyboard.press('Escape')
}
