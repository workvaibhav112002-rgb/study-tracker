import { expect, test } from '@playwright/test'

test('project exam fields save, and typing in dialogs never loses focus', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start for free' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('Editor User')
  await dialog.getByLabel('Email').fill(`e2e-editors-${Date.now()}@example.test`)
  await dialog.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')

  // Project with an exam date and a weekly plan shows both chips.
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'New project' }).click()
  const form = page.getByRole('dialog', { name: 'New project' })
  await form.getByLabel('Name').fill('Exam prep')
  const soon = new Date()
  soon.setDate(soon.getDate() + 10)
  await form.getByLabel('Exam date').fill(soon.toISOString().slice(0, 10))
  await form.getByLabel('Planned hours per week').fill('6')
  await form.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Exam in 10d')).toBeVisible()
  await expect(page.getByText('Behind plan · 0%')).toBeVisible()

  // Typing into a later field of a dialog keeps focus there (regression: the
  // focus trap used to re-run on every keystroke and jump to the first field).
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'New note' }).click()
  const note = page.getByRole('dialog', { name: 'New note' })
  await note.getByLabel('Title').fill('Focus test')
  const body = note.getByLabel('Body')
  await body.click()
  await page.keyboard.type('first line of the body')
  await expect(body).toBeFocused()
  await expect(body).toHaveValue('first line of the body')
  await note.getByRole('button', { name: 'Create note' }).click()
  await expect(page.getByText('Focus test')).toBeVisible()
})
