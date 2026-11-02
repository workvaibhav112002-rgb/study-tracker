import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const [, , html, framesDir, fpsArg, only] = process.argv
const fps = Number(fpsArg || 30)
mkdirSync(framesDir, { recursive: true })
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto('file://' + html)
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
const duration = await page.evaluate(() => window.DURATION)
const times = only ? only.split(',').map(Number) : Array.from({ length: Math.round(duration * fps) }, (_, i) => i / fps)
let n = 0
for (const t of times) {
  await page.evaluate((x) => window.seek(x), t)
  await page.screenshot({ path: `${framesDir}/f${String(n).padStart(5, '0')}.png`, type: 'png' })
  n++
}
console.log('frames', n)
await b.close()
