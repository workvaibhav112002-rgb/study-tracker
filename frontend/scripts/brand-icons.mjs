// Regenerates the PWA icons and the favicon data URI from the brand glyph.
// Usage (from frontend/): node scripts/brand-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = readFileSync(new URL('../src/components/ui/BrandMark.tsx', import.meta.url), 'utf8')
const paths = /BRAND_GLYPH_PATHS = `([^`]+)`/.exec(src)[1]
const glyph = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">${paths}</svg>`

// Favicon: emerald glyph on transparent, inlined in index.html.
const html = new URL('../index.html', import.meta.url)
const fav = 'data:image/svg+xml,' + glyph('#10b981').replaceAll('"', "'").replaceAll('#', '%23')
writeFileSync(html, readFileSync(html, 'utf8').replace(/(<link id="favicon"[^>]*href=")[^"]*(")/, `$1${fav}$2`))

const tile = (size, maskable, radius) => `<html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${maskable ? '#07080c' : 'transparent'}">
<div style="width:${maskable ? size * 0.72 : size}px;height:${maskable ? size * 0.72 : size}px;border-radius:${radius}%;background:linear-gradient(135deg,#6ee7b7,#10b981 55%,#047857);display:flex;align-items:center;justify-content:center">
<div style="width:60%;height:60%">${glyph('#07080c')}</div></div></div></body></html>`
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, maskable, radius] of [['icon-192.png', 192, false, 22], ['icon-512.png', 512, false, 22], ['icon-512-maskable.png', 512, true, 22], ['apple-touch-icon.png', 180, false, 0]]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(tile(size, maskable, radius))
  await page.screenshot({ path: fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)), omitBackground: !maskable && radius > 0 })
}
await browser.close()
console.log('icons and favicon updated')
