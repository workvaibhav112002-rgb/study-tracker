// Generates the Android launcher icons, splash screens and notification icon
// from the brand glyph. Usage (from frontend/): node scripts/android-assets.mjs
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const res = (p) => fileURLToPath(new URL(`../android/app/src/main/res/${p}`, import.meta.url))
const src = readFileSync(new URL('../src/components/ui/BrandMark.tsx', import.meta.url), 'utf8')
const paths = /BRAND_GLYPH_PATHS = `([^`]+)`/.exec(src)[1]
const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}">${paths}</svg>`
const GRADIENT = 'linear-gradient(135deg,#6ee7b7,#10b981 55%,#047857)'

const page = (w, h, body, bg = 'transparent') => `<html><body style="margin:0;background:${bg}"><div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${body}</div></body></html>`
const tile = (size, radius) => `<div style="width:${size}px;height:${size}px;border-radius:${radius};background:${GRADIENT};display:flex;align-items:center;justify-content:center"><div style="width:60%;height:60%">${svg('#07080c')}</div></div>`

const browser = await chromium.launch()
const p = await browser.newPage()
async function shot(file, w, h, html, transparent = true) {
  await p.setViewportSize({ width: w, height: h })
  await p.setContent(html)
  await p.screenshot({ path: res(file), omitBackground: transparent })
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(densities)) {
  const legacy = Math.round(48 * k), fg = Math.round(108 * k)
  await shot(`mipmap-${d}/ic_launcher.png`, legacy, legacy, page(legacy, legacy, tile(legacy, '22%')))
  await shot(`mipmap-${d}/ic_launcher_round.png`, legacy, legacy, page(legacy, legacy, tile(legacy, '50%')))
  // Adaptive foreground: glyph inside the 66 dp safe zone; the background colour comes from XML.
  await shot(`mipmap-${d}/ic_launcher_foreground.png`, fg, fg, page(fg, fg, `<div style="width:${fg * 0.42}px;height:${fg * 0.42}px">${svg('#07080c')}</div>`))
}
for (const [dir, w, h] of [
  ['drawable', 480, 320], ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920], ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720], ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280],
]) {
  const s = Math.round(Math.min(w, h) * 0.28)
  await shot(`${dir}/splash.png`, w, h, page(w, h, tile(s, '24%'), '#07080c'), false)
}
await browser.close()

writeFileSync(res('values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#10B981</color>\n</resources>\n`)
// Notification icon: white silhouette (Android tints it).
mkdirSync(res('drawable'), { recursive: true })
const circles = [...paths.matchAll(/cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  .map(([, cx, cy, r]) => `M${+cx - +r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`)
  .join(' ')
writeFileSync(res('drawable/ic_stat_granule.xml'), `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:fillColor="#FFFFFFFF" android:pathData="${circles}"/>\n</vector>\n`)
console.log('android assets written')
