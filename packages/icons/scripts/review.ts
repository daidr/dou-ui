/// <reference lib="es2023.array" />
/**
 * Build review sheets for icons: each icon enlarged on the 24 grid with the
 * keylines, the 3–21 safe area and its centerline, plus the 16/20/24/32/48
 * renders and the 16px render at 1× device pixels, enlarged. With Playwright
 * available, the sheets are also screenshotted and every icon is measured
 * (see review-page.js): the bounding box (3–21, wide/tall/special shapes up
 * to 2.5–21.5), gaps under 3.5 between strokes that do not join, and ink
 * against the set's median.
 *
 *   bun scripts/review.ts [names|--category <key>|--all] [--out <dir>] [--per <n>]
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = new URL('../', import.meta.url)
const source = new URL('icons/', root)

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args.splice(index, 2)[1]
}
const outDir = resolve(option('--out') ?? 'review')
const perSheet = Number(option('--per') ?? 12)
const category = option('--category')
const all = args.includes('--all')

const files = await readdir(source)
const known = files.filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5))
const metas = Object.fromEntries(
  await Promise.all(
    known.map(async (name) => [
      name,
      JSON.parse(await readFile(new URL(`${name}.json`, source), 'utf8')),
    ]),
  ),
) as Record<string, { label: string; categories: string[] }>

let names: string[]
if (all) names = known.toSorted()
else if (category)
  names = known.filter((name) => metas[name]!.categories.includes(category)).toSorted()
else names = (args[0] ?? '').split(',').filter(Boolean)
const missing = names.filter((name) => !metas[name])
if (!names.length || missing.length) {
  console.error(missing.length ? `Unknown icons: ${missing.join(', ')}` : 'No icons to review')
  process.exit(1)
}

const inner = async (name: string) =>
  (await readFile(new URL(`${name}.stroke.svg`, source), 'utf8'))
    .trim()
    .replace(/^<svg[^>]*>|<\/svg>$/g, '')

const grid = Array.from({ length: 23 }, (_, i) => i + 1)
  .map((i) => `<path d="M${i} 0V24M0 ${i}H24" class="g${i % 3 ? '' : ' m'}"/>`)
  .join('')
const keylines =
  '<path class="diagonal" d="M3 3l18 18M3 21 21 3"/>' +
  '<path class="axis" d="M0 12h24M12 0v24"/>' +
  '<circle cx="12" cy="12" r="9" class="k"/>' +
  '<rect x="4" y="4" width="16" height="16" rx="3" class="k"/>' +
  '<rect x="3" y="5" width="18" height="14" rx="3" class="k"/>' +
  '<rect x="4.5" y="3" width="15" height="18" rx="3" class="k"/>' +
  '<rect x="3" y="3" width="18" height="18" class="pad"/>'
const stroke = (size: number) => 0.75 + size / 32

const css = `body{font-family:sans-serif;margin:12px;background:#fff;color:#111;width:1500px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{border:1px solid #ddd;border-radius:8px;padding:8px}
.big{width:340px;height:340px;display:block}.big .g{stroke:#eee;stroke-width:.04}.big .g.m{stroke:#ddd}
.big .k{fill:none;stroke:#9cf;stroke-width:.05}.big .pad{fill:none;stroke:#f9a;stroke-width:.05;stroke-dasharray:.3 .3}
.big .ic *{stroke:#111;stroke-width:1.5px;stroke-linecap:round;stroke-linejoin:round;fill:none;opacity:.88}.big .ic .dot{stroke-width:2.25px}.big .ic .fill{fill:#111}
.big .sk *{stroke:#e33;stroke-width:.06;fill:none}
.row{display:flex;gap:10px;align-items:end;margin-top:6px}.row svg *{vector-effect:non-scaling-stroke}
.big .gaps circle{fill:none;stroke-width:.12}.big .gaps .merge{stroke:#e22}.big .gaps .tight{stroke:#e90}.big .gaps .overshoot{stroke:#e22;stroke-dasharray:.35 .2}
.pixels{margin-top:6px;font-size:11px;color:#777;display:flex;gap:8px;align-items:end}.px{width:96px;height:96px;image-rendering:pixelated;border:1px solid #eee}
.t{font-size:14px;font-weight:600}.b{font-size:11px;color:#777}.b.bad{color:#d22;font-weight:600}
.big .axis,.big .diagonal{fill:none;stroke:#8e9caf;stroke-width:.06}.big .diagonal{stroke:#bbc4d1;stroke-dasharray:.3 .3}
.badge-guides{fill:none;stroke:#278073;stroke-width:.09;stroke-dasharray:.22 .18}.badge-guides path{stroke-dasharray:none}
.big .badge-guides,.big .badge-clearance,.big .sk,.big .gaps{pointer-events:none}
.picking .ic>*{cursor:crosshair;pointer-events:visiblePainted}.picking .ic>*:hover{stroke:#167457}
.pick[aria-pressed=true]{background:#d9eee3}
.guide-controls{display:flex;gap:4px;margin-top:5px}.guide-controls select{max-width:60%;font:12px system-ui}
.guide-note,.legend{font:12px system-ui;color:#42535b;margin:5px 0}.mix{display:flex;gap:16px;margin-top:8px}
.mix span{display:inline-flex;gap:5px;align-items:center;font-family:system-ui,sans-serif;font-weight:400}.mix svg *{vector-effect:non-scaling-stroke}`

const guides = `<script>${await readFile(new URL('review-guides.js', import.meta.url), 'utf8')}</script>`
const measure = `<script>${await readFile(new URL('review-page.js', import.meta.url), 'utf8')}</script>`

async function card(name: string) {
  const body = await inner(name)
  const render = (size: number, weight: number) => {
    const shapes = body
      .replaceAll('class="dot"', `class="dot" style="stroke-width:${1.5 * weight}px"`)
      .replaceAll('class="fill"', 'fill="currentColor"')
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="stroke-width:${weight}px">${shapes}</svg>`
  }
  const sizes = [16, 20, 24, 32, 48].map((size) => render(size, stroke(size))).join('')
  const label = metas[name]!.label
  const mixed = [13, 16]
    .map(
      (size) =>
        `<span style="font-size:${size}px">${render(size * 1.125, stroke(size))}${label} Aa</span>`,
    )
    .join('')
  const attr = body.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<div class="card" data-name="${name}" data-body="${attr}">
    <div class="t">${name} · ${label}</div>
    <div class="guide-controls"><select class="corner" aria-label="角标位置"></select><select class="profile" aria-label="角标尺寸"></select><button class="pick" aria-pressed="false" title="开启后点击笔画，可加入或移出角标">选取笔画</button></div>
    <div class="guide-note"></div>
    <svg class="big" viewBox="0 0 24 24">${grid}${keylines}<g class="badge-clearance"></g><g class="ic">${body}</g><g class="sk">${body}</g><g class="badge-guides"></g><g class="gaps"></g></svg>
    <div class="row">${sizes}</div><div class="mix">${mixed}</div><div class="pixels"><span>16px · 1×</span></div><div class="b"></div></div>`
}

await mkdir(outDir, { recursive: true })
const sheets: string[] = []
for (let i = 0; i < names.length; i += perSheet) {
  const cards = await Promise.all(names.slice(i, i + perSheet).map(card))
  const file = resolve(outDir, `sheet-${String(sheets.length + 1).padStart(2, '0')}.html`)
  await writeFile(
    file,
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body><p class="legend">蓝色为外形基准，粉色为安全区。绿色十字和虚框标示角标中心与尺寸，绿色实线沿角标轮廓划出主体中心线的避让区。混排为 13 / 16px 正文，图标 1.125em。</p><div class="grid">${cards.join('')}</div>${measure}${guides}</body></html>`,
  )
  sheets.push(file)
}

const log = (line: string) => process.stdout.write(`${line}\n`)

// Optional: Playwright is not a dependency, so it is resolved at run time.
const playwright = 'playwright'
let chromium: { launch(): Promise<any> } | undefined
try {
  ;({ chromium } = await import(playwright))
} catch {
  log(`Playwright not found: open the sheets in a browser instead.\n${sheets.join('\n')}`)
  process.exit(0)
}

const browser = await chromium!.launch()
const page = await browser.newPage({ deviceScaleFactor: 1.5 })
const boxes: Record<
  string,
  {
    x: number
    y: number
    w: number
    h: number
    out: boolean
    edge: boolean
    gaps: { d: number; x: number; y: number }[]
    overshoots?: { d: number; x: number; y: number }[]
    ink: number
  }
> = {}
for (const sheet of sheets) {
  await page.goto(pathToFileURL(sheet).href)
  await page.waitForFunction('window.done', undefined, { timeout: 0 })
  Object.assign(boxes, await page.evaluate('window.boxes'))
  await page.screenshot({ path: sheet.replace(/\.html$/, '.png'), fullPage: true })
}
await browser.close()
await writeFile(resolve(outDir, 'boxes.json'), `${JSON.stringify(boxes, null, 2)}\n`)

const outside = names.filter((name) => boxes[name]?.out)
const edge = names.filter((name) => boxes[name]?.edge)
log(`${names.length} icons, ${sheets.length} sheets in ${outDir}`)
// Wide, tall and special shapes may reach 2.5–21.5; anything further is a bug.
if (edge.length) log(`Past 3–21 (fine only for wide/tall/special shapes): ${edge.join(', ')}`)
if (outside.length) log(`Outside 2.5–21.5: ${outside.join(', ')}`)
// Under 1.2 a joint misses (or the angle is too sharp); under 2.5 the strokes
// merge at 16px; 2.5–3.5 leaves less than 1px of white.
const gapList = (test: (d: number) => boolean) =>
  names
    .filter((name) => boxes[name]?.gaps.some((gap) => test(gap.d)))
    .map((name) => {
      const spots = boxes[name]!.gaps.filter((gap) => test(gap.d))
      return `${name} (${spots.map((gap) => `${gap.d}@${gap.x},${gap.y}`).join(' ')})`
    })
const joints = gapList((d) => d < 1.2)
const merged = gapList((d) => d >= 1.2 && d < 2.5)
const tight = gapList((d) => d >= 2.5)
if (joints.length)
  log(`Badge collisions or missed/sharp joints (gap < 1.2):\n  ${joints.join('\n  ')}`)
if (merged.length) log(`Strokes merging at 16px (gap 1.2–2.5):\n  ${merged.join('\n  ')}`)
if (tight.length) log(`Tight at 16px (below the applicable clearance):\n  ${tight.join('\n  ')}`)
const overshoots = names
  .filter((name) => boxes[name]?.overshoots?.length)
  .map((name) => {
    const spots = boxes[name]!.overshoots!
    return `${name} (${spots.map((spot) => `${spot.d}@${spot.x},${spot.y}`).join(' ')})`
  })
if (overshoots.length)
  log(`Endpoint overshoots (protruding past a crossing):\n  ${overshoots.join('\n  ')}`)
const heavy = names.filter((name) => (boxes[name]?.ink ?? 0) > 1.45)
if (heavy.length)
  log(`Heavier than 1.45× the median ink: ${heavy.map((n) => `${n} ${boxes[n]!.ink}`).join(', ')}`)
