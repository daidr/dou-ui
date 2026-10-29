/// <reference lib="es2023.array" />
/**
 * Build review sheets for the component overview drawings. Each drawing is
 * shown enlarged (400 × 240) in the light and dark theme with the safe area
 * and the center marked, next to its card at real size, and measured:
 *
 * - fill: the content box against the 200 × 120 canvas. The body belongs in
 *   the safe area (16–184 × 10–110) and should take about 55–85% of the
 *   width or 50–85% of the height, at least 30% of the height and 40% of
 *   the width, so cards look equally full.
 * - offset: how far the content box center sits from the canvas center.
 * - shapes: the number of drawn shapes; past 30 a drawing is usually too busy
 *   (patterns such as the QR code or the heatmap are judged by eye).
 * - tones: the tone colors used; more than two is rarely needed.
 *
 * Needs the docs dev server (`bun run docs:dev`) and Playwright.
 *
 *   bun scripts/review-art.ts [names] [--url <dev server>] [--out <dir>] [--per <n>]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args.splice(index, 2)[1]
}
const url = option('--url') ?? 'http://localhost:5173'
const outDir = resolve(option('--out') ?? 'review-art')
const perSheet = Number(option('--per') ?? 4)
const only = args[0]?.split(',').filter(Boolean)

interface Metric {
  name: string
  label: string
  x: number
  y: number
  width: number
  height: number
  shapes: number
  tones: string[]
}

const toneClasses: Record<string, string> = {
  a: 'primary',
  as: 'primary',
  la: 'primary',
  g: 'success',
  gs: 'success',
  lg: 'success',
  w: 'warning',
  ws: 'warning',
  lw: 'warning',
  r: 'danger',
  rs: 'danger',
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 2 })
await page.goto(`${url}/components/overview`, { waitUntil: 'networkidle' })

const metrics: Metric[] = await page.evaluate(
  ({ tones: toneMap }) =>
    [...document.querySelectorAll<HTMLAnchorElement>('.doc-overview__card')].map((card) => {
      const svg = card.querySelector('svg')!
      const box = svg.getBBox()
      const shapes = svg.querySelectorAll('rect, circle, path, polygon, text, line')
      const tones = new Set<string>()
      for (const shape of shapes) {
        for (const name of shape.classList) if (toneMap[name]) tones.add(toneMap[name]!)
      }
      return {
        name: card.getAttribute('href')!.split('/').pop()!,
        label: card.querySelector('.doc-overview__name')!.textContent!,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        shapes: [...shapes].filter((shape) => !shape.closest('defs')).length,
        tones: [...tones],
      }
    }),
  { tones: toneClasses },
)

const flags = (m: Metric) => {
  const list: string[] = []
  const fillX = m.width / 200
  const fillY = m.height / 120
  if (m.x < 15.5 || m.y < 9.5 || m.x + m.width > 184.5 || m.y + m.height > 110.5)
    list.push('超出安全区')
  if (fillX < 0.55 && fillY < 0.5) list.push('画面偏小')
  // a single row control (pagination, rating) may stay flat when it is wide
  else if (fillY < 0.3 && fillX < 0.65) list.push('画面偏扁')
  else if (fillX < 0.4 && fillY < 0.6) list.push('画面偏窄')
  if (fillX > 0.85 && fillY > 0.85) list.push('画面过满')
  const dx = m.x + m.width / 2 - 100
  const dy = m.y + m.height / 2 - 60
  if (Math.hypot(dx, dy) > 8) list.push(`偏离中心 ${dx.toFixed(0)},${dy.toFixed(0)}`)
  if (m.shapes > 30) list.push(`图形较多 ${m.shapes}`)
  if (m.tones.length > 2) list.push(`语气色 ${m.tones.length} 种`)
  return list
}

const selected = only ? metrics.filter((m) => only.includes(m.name)) : metrics
await mkdir(outDir, { recursive: true })

// Lay each sheet out inside the docs page, so the drawings use the real theme.
for (let start = 0; start < selected.length; start += perSheet) {
  const chunk = selected.slice(start, start + perSheet)
  await page.evaluate(
    ({ rows, notes }) => {
      document.querySelector('#review-sheet')?.remove()
      const sheet = document.createElement('div')
      sheet.id = 'review-sheet'
      sheet.style.cssText =
        'position:fixed;inset:0;z-index:1000;overflow:auto;padding:24px;background:#fafafa;font:13px system-ui'
      const guides =
        '<rect x="16" y="10" width="168" height="100" fill="none" stroke="#e5484d" stroke-opacity=".5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
        '<path d="M100 0v120M0 60h200" stroke="#e5484d" stroke-opacity=".25" vector-effect="non-scaling-stroke"/>'
      for (const m of rows) {
        const source = document.querySelector(`.doc-overview__card[href$="/${m.name}"]`)!
        const art = source.querySelector('svg')!.innerHTML
        const box = `<rect x="${m.x}" y="${m.y}" width="${m.width}" height="${m.height}" fill="none" stroke="#3e63dd" stroke-opacity=".6" vector-effect="non-scaling-stroke"/>`
        const big = (theme: string) =>
          `<div data-dou-theme="${theme}" style="background:var(--dou-color-bg-canvas);border:1px solid #ddd;border-radius:8px;overflow:hidden">` +
          `<svg class="doc-overview__art" viewBox="0 0 200 120" style="width:400px;border:0">${art}${guides}${box}</svg></div>`
        const card = `<div data-dou-theme="light" style="width:200px">${source.outerHTML}</div>`
        const row = document.createElement('div')
        row.style.cssText =
          'display:grid;grid-template-columns:400px 400px 200px;gap:12px;margin-bottom:20px;align-items:start'
        row.innerHTML =
          `<div style="grid-column:1/-1;font-weight:600">${m.label} <span style="font-weight:400;color:#666">` +
          `${m.name} · 宽 ${Math.round((m.width / 200) * 100)}% 高 ${Math.round((m.height / 120) * 100)}% · ` +
          `图形 ${m.shapes} · 语气色 ${m.tones.join('/') || '无'}` +
          `${notes[m.name]!.length ? ` · <b style="color:#c4342b">${notes[m.name]!.join('，')}</b>` : ''}</span></div>` +
          big('light') +
          big('dark') +
          card
        sheet.append(row)
      }
      document.body.append(sheet)
    },
    { rows: chunk, notes: Object.fromEntries(chunk.map((m) => [m.name, flags(m)])) },
  )
  const sheet = page.locator('#review-sheet')
  const height = await sheet.evaluate((el) => el.scrollHeight)
  await page.setViewportSize({ width: 1180, height })
  const index = String(start / perSheet + 1).padStart(2, '0')
  await sheet.screenshot({ path: resolve(outDir, `sheet-${index}.png`) })
}

const report = [
  '| 组件 | 宽 | 高 | 中心偏移 | 图形 | 语气色 | 自动提示 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...selected.map((m) => {
    const dx = m.x + m.width / 2 - 100
    const dy = m.y + m.height / 2 - 60
    return `| ${m.label} | ${Math.round((m.width / 200) * 100)}% | ${Math.round((m.height / 120) * 100)}% | ${dx.toFixed(0)}, ${dy.toFixed(0)} | ${m.shapes} | ${m.tones.join('/') || '—'} | ${flags(m).join('，') || '—'} |`
  }),
].join('\n')
await writeFile(resolve(outDir, 'metrics.md'), `${report}\n`)
process.stdout.write(`${report}\n\n${selected.length} drawings, sheets in ${outDir}\n`)
await browser.close()
