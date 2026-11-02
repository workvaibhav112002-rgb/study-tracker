import { expect, test, type Locator, type Page } from '@playwright/test'
import { createProject } from './helpers'

// Pills are visually hidden radios/checkboxes inside labels: click the label as a user would.
const pick = (scope: Locator, name: string) => scope.locator('label').filter({ hasText: new RegExp(`^${name.replace(/[()/?.]/g, '\\$&')}$`) }).click()

async function signUp(page: Page, tag: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start for free' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('Test User')
  await dialog.getByLabel('Email').fill(`e2e-${tag}-${Date.now()}@example.test`)
  await dialog.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')
}

test('new accounts start empty, and the journal finds patterns, customizes, reviews and makes flashcards', async ({ page }) => {
  await signUp(page, 'journal')
  // No sample projects.
  await page.keyboard.press('8')
  await expect(page.getByText('Learn from every mistake')).toBeVisible()
  await createProject(page, 'Maths')
  await page.keyboard.press('8')
  await expect(page.getByText('Your mistakes, turned into a plan')).toBeVisible()

  // Three careless slips on Fractions, entered with the keyboard.
  await page.keyboard.press('e')
  const form = page.getByRole('dialog', { name: 'Log a mistake' })
  for (let i = 0; i < 3; i++) {
    await form.getByLabel('Or type a topic').or(form.getByLabel('Topic', { exact: true })).first().fill('Fractions')
    await pick(form, 'Careless slip')
    await form.getByLabel('What went wrong').fill(`Added denominators ${i + 1}`)
    const rule = form.getByLabel('Lesson for next time')
    await rule.click()
    await page.keyboard.type('Find a common denominator ')
    await form.getByRole('button', { name: 'Insert →' }).click()
    await page.keyboard.type(' then add')
    await expect(rule).toHaveValue('Find a common denominator → then add')
    await page.keyboard.press('Control+Enter')
    await expect(form.getByText(`${i + 1} logged this sitting. Next one.`)).toBeVisible()
  }
  await form.getByRole('button', { name: 'Done' }).click()

  // Pattern banner and dashboard focus list.
  await expect(page.getByRole('alert').filter({ hasText: 'Repeating mistake' }).first()).toContainText('Fractions · Careless slip: 3× in 14 days')
  const focus = page.getByTestId('focus-next')
  await expect(focus.getByRole('listitem').first()).toContainText('Fractions')
  await expect(focus.getByRole('listitem').first()).toContainText('3 in the last 2 weeks')
  await expect(page.getByTestId('weekly-chart')).toBeVisible()

  // Review only that topic from the dashboard.
  await focus.getByRole('button', { name: 'Review mistakes for Fractions' }).click()
  const deck = page.getByRole('dialog', { name: 'Review: Fractions' })
  await expect(deck).toContainText('1 / 3')
  await page.keyboard.press('Space')
  await expect(deck.getByText('Find a common denominator → then add')).toBeVisible()
  await deck.getByRole('button', { name: 'Make flashcard' }).click()
  await expect(page.getByText('Made 1 flashcard in Cards.')).toBeVisible()
  await page.keyboard.press('1')
  await expect(deck).toContainText('2 / 3')
  await page.keyboard.press('Space')
  await page.keyboard.press('2')
  await expect(deck).toContainText('3 / 3')
  await page.keyboard.press('Escape')
  await expect(page.getByText(/Reviewed 2: 1 locked in/)).toBeVisible()

  // Customize: rename an option, add a category and a yes/no field.
  await page.getByRole('button', { name: /^Customize/ }).click()
  const setup = page.getByRole('dialog', { name: 'Customize your mistake journal' })
  await setup.getByRole('button', { name: 'Mistake type', exact: true }).click()
  await setup.getByLabel('Option 2 name').fill('Silly error')
  await setup.getByRole('button', { name: 'Add category' }).click()
  await setup.getByLabel('Category name').fill('Chapter')
  await setup.getByRole('tab', { name: 'Fields' }).click()
  await setup.getByRole('button', { name: 'Add custom field' }).click()
  await setup.getByLabel('Label for Custom field').fill('Asked the teacher')
  await setup.getByLabel('Type of Asked the teacher').selectOption('yesno')
  await setup.getByRole('button', { name: 'Save setup' }).click()
  await expect(page.getByText('Saved as your default setup.')).toBeVisible()

  // Old entries show the new name; the form has the new category and field.
  await page.getByRole('tab', { name: /^Journal/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Added denominators 1' })).toContainText('Silly error')
  await page.keyboard.press('e')
  const form2 = page.getByRole('dialog', { name: 'Log a mistake' })
  await expect(form2.getByText('Chapter', { exact: true })).toBeVisible()
  await expect(form2.getByLabel('Asked the teacher')).toBeVisible()
  await form2.getByRole('button', { name: 'Cancel' }).click()

  // Patterns matrix: Topic x Mistake type.
  await page.getByRole('tab', { name: 'Patterns' }).click()
  await expect(page.getByTestId('pattern-matrix').getByRole('button', { name: 'Fractions and Silly error: 3' })).toBeVisible()

  // The flashcard landed in Cards.
  await page.keyboard.press('3')
  await expect(page.getByText('Added denominators').first()).toBeVisible()
})

test('tests add-on and drafts', async ({ page }) => {
  await signUp(page, 'journal-tests')
  await createProject(page, 'AWS')
  await page.keyboard.press('8')

  // Turn the Tests add-on on from Customize.
  await page.getByRole('button', { name: /^Customize/ }).click()
  const setup = page.getByRole('dialog', { name: 'Customize your mistake journal' })
  await setup.getByRole('tab', { name: 'Tests' }).click()
  await setup.getByLabel('Track test scores').check()
  await setup.getByRole('button', { name: 'Save setup' }).click()
  await expect(page.getByText('Saved as your default setup.')).toBeVisible()

  await page.keyboard.press('t')
  const testForm = page.getByRole('dialog', { name: 'Log a test' })
  await testForm.getByLabel('Test name').fill('Practice exam 1')
  await testForm.getByRole('spinbutton', { name: 'Score', exact: true }).fill('72')
  await expect(testForm.getByTestId('mock-net')).toContainText('72 / 100')
  await testForm.getByRole('button', { name: 'Log test' }).click()
  await expect(page.getByText('Test logged.')).toBeVisible()
  await expect(page.getByTestId('score-trend')).toBeVisible()

  // An unsaved mistake survives a reload as a draft.
  await page.keyboard.press('e')
  const form = page.getByRole('dialog', { name: 'Log a mistake' })
  await form.getByLabel('What went wrong').fill('Picked the cheaper storage class, missed the retrieval time')
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Log mistake E' })).toBeVisible()
  await page.keyboard.press('e')
  const again = page.getByRole('dialog', { name: 'Log a mistake' })
  await expect(again.getByText('Restored your unsaved draft.')).toBeVisible()
  await expect(again.getByLabel('What went wrong')).toHaveValue('Picked the cheaper storage class, missed the retrieval time')
  await again.getByRole('button', { name: 'Cancel' }).click()

  // Every view fits a phone.
  await page.setViewportSize({ width: 375, height: 800 })
  for (const tab of ['Dashboard', 'Journal', 'Patterns', 'Review', 'Tests']) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, tab).toBeLessThanOrEqual(0)
  }
})
