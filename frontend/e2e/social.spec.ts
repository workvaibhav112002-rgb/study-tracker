import { expect, test, type APIRequestContext } from '@playwright/test'

const api = process.env.API_URL ?? 'http://localhost:8080'

async function register(request: APIRequestContext, name: string) {
  const res = await request.post(`${api}/api/auth/register`, {
    data: { email: `e2e-${name}-${Date.now()}@example.test`, password: 'e2e-password-123', name },
  })
  expect(res.status()).toBe(201)
  return (await res.json()) as { token: string; user: { id: number } }
}

test('friend invite links two accounts and a public profile renders anonymously', async ({ page, request }) => {
  const a = await register(request, 'Alpha')
  const b = await register(request, 'Beta')
  const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

  // A publishes a profile.
  const handle = `alpha-${Date.now().toString(36)}`
  const prof = await request.put(`${api}/api/auth/profile`, { ...auth(a.token), data: { handle, profile_public: true, bio: 'Learning in public' } })
  expect(prof.status()).toBe(200)

  // A invites, B accepts through the app's /friend link while signed in.
  const inv = await request.post(`${api}/api/friends/invite`, auth(a.token))
  expect(inv.status()).toBe(201)
  const { token: inviteToken } = (await inv.json()) as { token: string }

  await page.goto('/')
  await page.evaluate((t) => localStorage.setItem('study_tracker_token', t), b.token)
  await page.goto(`/friend?token=${inviteToken}`)
  await expect(page.getByText('You and Alpha are now friends.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Weekly leaderboard' }).or(page.locator('ol'))).toContainText('Alpha')

  // Anyone can open the public profile, even signed out.
  await page.evaluate(() => localStorage.clear())
  await page.goto(`/u/${handle}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alpha')
  await expect(page.getByText('Learning in public')).toBeVisible()
  await expect(page.getByText(`@${handle}`)).toBeVisible()
})
