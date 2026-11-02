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
