/// <reference lib="es2023.array" />
/**
 * Measure every @dou-ui/icons icon on the docs pages and report the ones
 * that are sized or placed differently from their neighbours. Catches what
 * screenshots only show to a careful eye:
 *
 * - offset: the icon's vertical center sits more than 0.75px from the
 *   center of the control it is in (button, toggle, menu item, tab…).
 *   Controls taller than 44px (cards) and stacked icon pairs are skipped.
 * - size: the button icons of one toolbar, button group or toggle group are
 *   not all the same size.
 *
 * Tilted boxes (3D or rotated, like the home page wall) are skipped.
 *
 * Without `--open` only what the page shows without interaction is measured.
 * `--open` also opens each popup trigger in the demos (`aria-haspopup`,
 * up to 40 a page) and measures the menu, list, dialog or popover it opens;
 * submenus and layers that need more steps are still checked by hand.
 *
 * A page that fails to open counts as a failure: it was not measured.
 *
 * Needs Playwright and the docs dev server (`bun run docs:dev`, the
 * default URL) or a preview server (`--url`). Exits with 1 when something
 * is found.
 *
 * `--changed <git ref>` measures only the pages a branch touches since that
 * ref: changed pages and demos, the docs of a changed ecosystem package, and
 * for a changed base component its own page plus up to 20 pages whose demos
 * use it. CI runs it this way on pull requests.
 *
 *   bun run audit:icons [paths] [--open] [--changed <ref>] [--url <server>] [--json]
 *
 * Paths are site paths such as `/sheet/` or `components/button`.
 */
import { fileURLToPath } from 'node:url'
import { Glob } from 'bun'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args.splice(i, 2)[1]
}
const base = (flag('--url') ?? 'http://localhost:5173').replace(/\/$/, '')
const changedSince = flag('--changed')
const openLayers = args.includes('--open') && !!args.splice(args.indexOf('--open'), 1)
const json = args.includes('--json') && !!args.splice(args.indexOf('--json'), 1)
const only = args
const docsRoot = fileURLToPath(new URL('..', import.meta.url))

const OFFSET = 0.75
const SIZE = 0.5

interface Finding {
  page: string
  rule: 'offset' | 'size'
  where: string
  detail: string
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

/** The markdown files of the site, relative to the docs folder. */
async function markdown() {
  const files = await Array.fromAsync(new Glob('**/*.md').scan({ cwd: docsRoot }))
  return files.filter((f) => !f.startsWith('node_modules/') && !f.includes('/node_modules/'))
}

const pageOf = (file: string) => `/${file.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')}`

/** How many pages a changed base component brings in through the demos that use it. */
const USERS = 20

/** The pages a branch touches since `ref`. */
async function changedPages(ref: string) {
  const diff = Bun.spawnSync(['git', 'diff', '--name-only', `${ref}...HEAD`], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
  })
  if (diff.exitCode) throw new Error(diff.stderr.toString())
  const files = diff.stdout.toString().split('\n').filter(Boolean)
  const mds = await markdown()
  const texts = new Map(
    await Promise.all(mds.map(async (f) => [f, await Bun.file(docsRoot + f).text()] as const)),
  )
  const demos = await Array.fromAsync(new Glob('examples/**/*.vue').scan({ cwd: docsRoot }))
  const demoTexts = new Map(
    await Promise.all(demos.map(async (f) => [f, await Bun.file(docsRoot + f).text()] as const)),
  )
  const showing = (demo: string) => mds.filter((f) => texts.get(f)!.includes(`src="${demo}"`))
  const out = new Set<string>()
  for (const file of files) {
    let m: RegExpExecArray | null
    if ((m = /^docs\/(.+\.md)$/.exec(file))) {
      if (texts.has(m[1]!)) out.add(m[1]!)
    } else if ((m = /^docs\/examples\/(.+)\.vue$/.exec(file))) {
      for (const md of showing(m[1]!)) out.add(md)
    } else if (
      (m =
        /^packages\/(?:dou-ui\/src\/components\/([\w-]+)\/|theme\/src\/components\/([\w-]+)\.css$)/.exec(
          file,
        ))
    ) {
      const name = (m[1] ?? m[2])!
      if (texts.has(`components/${name}.md`)) out.add(`components/${name}.md`)
      const tag = `Dou${name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`
      const use = new RegExp(`<${tag}[\\s/>]`)
      const users = demos
        .filter((d) => use.test(demoTexts.get(d)!))
        .flatMap((d) => showing(d.replace(/^examples\//, '').replace(/\.vue$/, '')))
      for (const md of [...new Set(users)].toSorted().slice(0, USERS)) out.add(md)
    } else if ((m = /^packages\/([\w-]+)\/src\//.exec(file))) {
      for (const md of mds) if (md.startsWith(`${m[1]}/`)) out.add(md)
    }
  }
  return [...out].map(pageOf).toSorted()
}

/** The pages to measure: those named, those a branch touches, or every page. */
async function pagesOf() {
  if (only.length) return only
  if (changedSince) return changedPages(changedSince)
  return (await markdown()).map(pageOf).toSorted()
}

/** Measures the icons on the page, or only inside the open layers that `scope` matches. */
const measure = ({
  offset: maxOffset,
  size: step,
  scope,
}: {
  offset: number
  size: number
  scope?: string
}) => {
  const out: { rule: 'offset' | 'size'; where: string; detail: string }[] = []
  const headings = [...document.querySelectorAll('.doc-content h2, .doc-content h3')]
  const name = (el: Element) => {
    const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16) ?? ''
    const cls = [...el.classList].find((c) => c.startsWith('dou-')) ?? el.tagName.toLowerCase()
    // the section the element is in, to find the demo
    const section = headings
      .filter((h) => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      .at(-1)
      ?.textContent?.replace(/[#\u200b]/g, '')
      .trim()
    return `${cls}${label ? ` "${label}"` : ''}${section ? ` (${section})` : ''}`
  }
  // icons from the set carry the stroke variable that createIcon sets
  const roots: ParentNode[] = scope
    ? [...document.querySelectorAll(scope)].filter((el) => el.getBoundingClientRect().width > 0)
    : [document]
  const all = (selector: string) => roots.flatMap((root) => [...root.querySelectorAll(selector)])
  const icons = all('svg[style*="--dou-icons-stroke"]')
  const CONTROL =
    'button, [role="button"], [role^="menuitem"], [role="option"], [role="tab"], .dou-toggle, .dou-tag'
  // rotated, scaled or 3D-tilted boxes (the home page wall) can't be measured on screen
  const tiltedBox = new Map<Element, boolean>()
  const tilted = (el: Element | null): boolean => {
    if (!el) return false
    let known = tiltedBox.get(el)
    if (known === undefined) {
      const t = getComputedStyle(el).transform
      const m = t === 'none' ? undefined : new DOMMatrix(t)
      known =
        (!!m && (!m.is2D || m.a !== 1 || m.b !== 0 || m.c !== 0 || m.d !== 1)) ||
        tilted(el.parentElement)
      tiltedBox.set(el, known)
    }
    return known
  }
  for (const icon of icons) {
    const r = icon.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const control = icon.closest(CONTROL)
    if (!control || tilted(control)) continue
    const c = control.getBoundingClientRect()
    // cards and controls that wrap onto lines have no single center to match
    if (c.height > 44) continue
    // icons stacked on purpose (a sort caret pair) sit off center by design
    const stacked = [...control.querySelectorAll('svg[style*="--dou-icons-stroke"]')].some(
      (other) => {
        if (other === icon) return false
        const o = other.getBoundingClientRect()
        return o.width > 0 && o.left < r.right && r.left < o.right
      },
    )
    if (stacked) continue
    const style = getComputedStyle(control)
    const top = c.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop)
    const bottom = c.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom)
    const off = (r.top + r.bottom) / 2 - (top + bottom) / 2
    if (Math.abs(off) > maxOffset)
      out.push({
        rule: 'offset',
        where: name(control),
        detail: `icon ${off > 0 ? 'low' : 'high'} by ${Math.abs(off).toFixed(2)}px`,
      })
  }
  // icons inside fields, like a clear button, are left out
  const GROUP = '[role="toolbar"], .dou-button-group, .dou-toggle-group'
  for (const group of all(GROUP)) {
    if (group.parentElement?.closest(GROUP)) continue
    const sizes = new Map<string, number>()
    for (const icon of group.querySelectorAll<SVGSVGElement>('svg[style*="--dou-icons-stroke"]')) {
      const r = icon.getBoundingClientRect()
      const button = icon.closest('button, [role="button"]')
      if (!r.width || !r.height || !button?.matches('.dou-button, .dou-toggle') || tilted(icon))
        continue
      const key = (Math.round(r.height / step) * step).toFixed(1)
      sizes.set(key, (sizes.get(key) ?? 0) + 1)
    }
    if (sizes.size > 1)
      out.push({
        rule: 'size',
        where: name(group),
        detail: [...sizes].map(([s, n]) => `${n}× ${s}px`).join(', '),
      })
  }
  return out
}

/** The layers a trigger opens: menus, lists, dialogs and popovers. */
const LAYERS = '[role="menu"], [role="listbox"], [role="dialog"], .dou-floating'
/** How many popup triggers to open on one page. */
const TRIGGERS = 40

/** Opens each popup trigger in the page body in turn and measures what it opens. */
async function measureLayers() {
  const out: (Omit<Finding, 'page'> & { trigger: string })[] = []
  const selector =
    '.doc-demo [aria-haspopup]:not([disabled]):not([aria-disabled="true"]):not([aria-haspopup="false"])'
  const count = Math.min(await page.locator(selector).count(), TRIGGERS)
  for (let i = 0; i < count; i++) {
    const trigger = page.locator(selector).nth(i)
    if (!(await trigger.isVisible())) continue
    const label =
      (await trigger.getAttribute('aria-label')) ?? (await trigger.innerText()).trim().slice(0, 16)
    try {
      await trigger.click({ timeout: 2000 })
    } catch {
      continue
    }
    await page.waitForTimeout(350)
    for (const f of await page.evaluate(measure, { offset: OFFSET, size: SIZE, scope: LAYERS }))
      out.push({ ...f, trigger: label })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
  return out
}

const findings: Finding[] = []
const failed: string[] = []
const paths = (await pagesOf()).map((p) => (p.startsWith('/') ? p : `/${p}`))
if (!paths.length) process.stdout.write('No pages to measure.\n')

const report = (f: Finding) => {
  findings.push(f)
  if (!json) process.stdout.write(`${f.page}  [${f.rule}] ${f.where}: ${f.detail}\n`)
}

for (const path of paths) {
  try {
    const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60_000 })
    if (res && !res.ok()) throw new Error(`HTTP ${res.status()}`)
    // the dev server answers unknown paths with the 404 page
    if ((await page.title()).startsWith('404')) throw new Error('404 page')
  } catch (error) {
    failed.push(path)
    process.stderr.write(`${path}: ${(error as Error).message.split('\n')[0]}\n`)
    continue
  }
  await page.waitForTimeout(300)
  for (const f of await page.evaluate(measure, { offset: OFFSET, size: SIZE }))
    report({ page: path, ...f })
  if (openLayers)
    for (const { trigger, ...f } of await measureLayers())
      report({ page: path, ...f, where: `${trigger} › ${f.where}` })
}

await browser.close()

process.stdout.write(
  json
    ? `${JSON.stringify({ findings, failed }, null, 2)}\n`
    : `\n${paths.length} pages, ${findings.length} findings${failed.length ? `, ${failed.length} pages failed to open` : ''}\n`,
)
// a page that didn't open was not measured, so it can't pass
process.exit(findings.length || failed.length ? 1 : 0)
