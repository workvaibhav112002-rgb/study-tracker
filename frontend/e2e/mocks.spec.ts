import { expect, test, type Page } from '@playwright/test'

// The pills are visually hidden radios inside labels, so click the label as a user would.
const pick = (scope: ReturnType<Page['getByRole']>, name: string) => scope.locator('label').filter({ hasText: new RegExp(`^${name.replace(/[()/]/g, '\\$&')}$`) }).click()

async function signUpWithProject(page: Page, tag: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start for free' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('Test User')
  await dialog.getByLabel('Email').fill(`e2e-${tag}-${Date.now()}@example.test`)
  await dialog.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'New project' }).click()
  const form = page.getByRole('dialog', { name: 'New project' })
  await form.getByLabel('Name').fill('IBPS PO')
  await form.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Project created.')).toBeVisible()
}

test('exam pattern, mock score flags, keyboard mistake entry, repeat alert and Sunday Reset', async ({ page }) => {
  await signUpWithProject(page, 'mocks')
  await page.keyboard.press('8')
  await page.getByLabel('Exam track').selectOption({ label: 'IBPS PO' })
  await expect(page.getByText('No mocks logged for IBPS PO yet.')).toBeVisible()

  // Exam pattern from a preset.
  await page.getByRole('button', { name: 'Set exam pattern' }).first().click()
  const pattern = page.getByRole('dialog', { name: 'Exam pattern for IBPS PO' })
  await pattern.getByLabel('Start from a preset').selectOption('ibps-po-pre')
  await pattern.getByLabel('Target score').fill('60')
  await pattern.getByRole('button', { name: 'Save pattern' }).click()
  await expect(page.getByText('IBPS PO Prelims · target 60')).toBeVisible()

  // Mock: sections come from the template; low accuracy is flagged live.
  await page.keyboard.press('m')
  const mock = page.getByRole('dialog', { name: 'Log a mock test' })
  await mock.getByLabel('Mock name').fill('Full mock 1')
  await mock.getByLabel('English correct').fill('24')
  await mock.getByLabel('English incorrect').fill('2')
  await mock.getByLabel('Quant correct').fill('20')
  await mock.getByLabel('Quant incorrect').fill('11')
  await mock.getByLabel('Reasoning correct').fill('28')
  await mock.getByLabel('Reasoning incorrect').fill('2')
  await expect(mock.getByTestId('section-score-1')).toHaveText('17.25 / 35 · 64.52% acc · 88.57% att')
  await expect(mock.getByText(/accuracy 64.52% is below the safety line · 2.75 marks lost to negatives/)).toBeVisible()
  await expect(mock.getByTestId('mock-net')).toContainText('68.25 / 100')
  await mock.getByRole('button', { name: 'Log mock' }).click()
  await expect(page.getByText('Mock logged.')).toBeVisible()
  await expect(page.getByText('Full mock 1')).toBeVisible()

  // Three keyboard-only mistakes with the same pattern and root cause.
  await page.getByRole('button', { name: 'Log mistakes' }).click()
  const form = page.getByRole('dialog', { name: 'Log a mistake' })
  for (let i = 0; i < 3; i++) {
    await pick(form, 'Reasoning')
    await form.getByLabel('Or type a pattern').fill('Seating: Circular (in/out)')
    await pick(form, 'Time panic / ego trap')
    await form.getByLabel('Question and trap').fill(`Circular seating ${i + 1}: forced it past 2 minutes`)
    await form.getByLabel('Actual time (sec)').fill('150')
    await form.getByLabel('Ideal time (sec)').fill('45')
    const rule = form.getByLabel('Execution rule')
    await rule.click()
    await page.keyboard.type('Bail out at 45 seconds')
    await expect(rule).toBeFocused()
    await page.keyboard.press('Control+Enter')
    await expect(form.getByText(`${i + 1} logged this sitting. Next one.`)).toBeVisible()
  }
  await form.getByRole('button', { name: 'Done' }).click()

  // Repeat-error alert pinned on the Mocks tab and on the Focus tab.
  await expect(page.getByRole('alert').filter({ hasText: '#repeat-error' })).toContainText('Seating: Circular (in/out): 3× time panic / ego trap')
  await page.keyboard.press('1')
  await page.getByRole('button', { name: /Seating: Circular \(in\/out\): 3×/ }).click()
  await expect(page.getByRole('tab', { name: /Error log/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('3 of 3 mistakes')).toBeVisible()

  // Sunday Reset: flip and grade with the keyboard.
  await page.getByRole('tab', { name: 'Sunday Reset' }).click()
  await page.getByRole('button', { name: 'Start: 3 mistakes' }).click()
  const deck = page.getByRole('dialog', { name: 'Sunday Reset' })
  for (const key of ['1', '2', '3']) {
    await expect(deck.getByText('The trap')).toBeVisible()
    await page.keyboard.press('Space')
    await expect(deck.getByText('Bail out at 45 seconds')).toBeVisible()
    await page.keyboard.press(key)
  }
  await expect(page.getByText(/Reviewed 3: 1 locked in, 1 need a concept drill/)).toBeVisible()
  // Only the drill card stays in this week's deck.
  await expect(page.getByRole('button', { name: 'Start: 1 mistake' })).toBeVisible()

  // Insights render all three panels.
  await page.getByRole('tab', { name: 'Insights' }).click()
  await expect(page.getByTestId('cutoff-chart')).toBeVisible()
  await expect(page.getByText('clearing the bar')).toBeVisible()
  await expect(page.getByTestId('pattern-matrix')).toContainText('Seating: Circular (in/out)')
  await expect(page.getByTestId('pattern-matrix')).toContainText('Skip until fixed')
})

test('an unsaved mistake survives closing the tab as a draft', async ({ page }) => {
  await signUpWithProject(page, 'mock-draft')
  await page.keyboard.press('8')
  await page.getByRole('button', { name: /Log mistake/ }).click()
  const form = page.getByRole('dialog', { name: 'Log a mistake' })
  await pick(form, 'Quant')
  await form.getByLabel('Question and trap').fill('Pie chart in thousands, answered in lakhs')
  // Symbol buttons insert at the cursor and leave focus in the rule box
  // (regression: focus moved to the button, so typed spaces re-clicked it).
  const rule = form.getByLabel('Execution rule')
  await rule.click()
  await page.keyboard.type('units ')
  await form.getByRole('button', { name: 'Insert →' }).click()
  await page.keyboard.type(' lakhs')
  await expect(rule).toHaveValue('units → lakhs')
  await expect(rule).toBeFocused()
  await page.waitForTimeout(600)
  await page.reload()
  await page.getByRole('button', { name: /Log mistake/ }).click()
  const again = page.getByRole('dialog', { name: 'Log a mistake' })
  await expect(again.getByText('Restored your unsaved draft.')).toBeVisible()
  await expect(again.getByLabel('Question and trap')).toHaveValue('Pie chart in thousands, answered in lakhs')
  await expect(again.getByRole('radio', { name: 'Quant' })).toBeChecked()

  await again.getByRole('button', { name: 'Cancel' }).click()

  // Every Mocks view fits a phone without horizontal scroll.
  await page.setViewportSize({ width: 375, height: 800 })
  for (const tab of ['Mocks', 'Error log', 'Sunday Reset', 'Insights']) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, tab).toBeLessThanOrEqual(0)
  }
})
