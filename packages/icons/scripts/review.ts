/// <reference lib="es2023.array" />
/**
 * Build review sheets for icons: each icon enlarged on the 24 grid with the
 * keylines, the 3–21 safe area and its centerline, plus the 16/20/24/32/48
 * renders. With Playwright available, the sheets are also screenshotted and
 * every icon's bounding box is measured: the body belongs in 3–21, and only
 * wide, tall or special shapes may reach 2.5–21.5.
 *
 *   bun scripts/review.ts [names|--category <key>|--all] [--out <dir>] [--per <n>]
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

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
.big .ic *{stroke:#111;stroke-width:1.5px;stroke-linecap:round;stroke-linejoin:round;fill:none;opacity:.88}.big .ic .dot{stroke-width:2.25px}
.big .sk *{stroke:#e33;stroke-width:.06;fill:none}
.row{display:flex;gap:10px;align-items:end;margin-top:6px}.row svg *{vector-effect:non-scaling-stroke}
.t{font-size:14px;font-weight:600}.b{font-size:11px;color:#777}.b.bad{color:#d22;font-weight:600}`

const measure = `<script>window.boxes={};document.querySelectorAll('.card').forEach(c=>{const b=c.querySelector('.ic').getBBox();
const r=b.x+b.width,d=b.y+b.height,out=b.x<2.49||b.y<2.49||r>21.51||d>21.51,edge=!out&&(b.x<2.98||b.y<2.98||r>21.02||d>21.02);window.boxes[c.dataset.name]={x:b.x,y:b.y,w:b.width,h:b.height,out,edge};
const el=c.querySelector('.b');el.textContent='bbox x '+b.x.toFixed(2)+'–'+(b.x+b.width).toFixed(2)+'  y '+b.y.toFixed(2)+'–'+(b.y+b.height).toFixed(2)+'  ('+b.width.toFixed(2)+'×'+b.height.toFixed(2)+')'+(out?'  超出 2.5–21.5':edge?'  越过 3–21':'');if(out)el.classList.add('bad')})</script>`

async function card(name: string) {
  const body = await inner(name)
  const sizes = [16, 20, 24, 32, 48]
    .map((size) => {
      const dotted = body.replaceAll(
        'class="dot"',
        `class="dot" style="stroke-width:${1.5 * stroke(size)}px"`,
      )
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="stroke-width:${stroke(size)}px">${dotted}</svg>`
    })
    .join('')
  return `<div class="card" data-name="${name}"><div class="t">${name} · ${metas[name]!.label}</div><svg class="big" viewBox="0 0 24 24">${grid}${keylines}<g class="ic">${body}</g><g class="sk">${body}</g></svg><div class="row">${sizes}</div><div class="b"></div></div>`
}

await mkdir(outDir, { recursive: true })
const sheets: string[] = []
for (let i = 0; i < names.length; i += perSheet) {
  const cards = await Promise.all(names.slice(i, i + perSheet).map(card))
  const file = resolve(outDir, `sheet-${String(sheets.length + 1).padStart(2, '0')}.html`)
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="grid">${cards.join('')}</div>${measure}</body></html>`,
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
  { x: number; y: number; w: number; h: number; out: boolean; edge: boolean }
> = {}
for (const sheet of sheets) {
  await page.goto(`file://${sheet}`)
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
