/**
 * Work out which stylesheets each component needs, so it can be styled on
 * its own: `dou-ui/components/<dir>/style` imports exactly those.
 *
 * A component needs every stylesheet that styles a class it (or anything it
 * imports, followed transitively) renders. Classes are read from
 * `useNamespace('<block>')` calls and `dou-*` literals in the source.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const here = dirname(new URL(import.meta.url).pathname)
const src = resolve(here, '../src')
const themeSrc = resolve(here, '../../theme/src')

/** Component stylesheets in the cascade order of the full stylesheet. */
export function stylesheetOrder(): string[] {
  const index = readFileSync(join(themeSrc, 'index.css'), 'utf8')
  return [...index.matchAll(/@import '\.\/components\/([a-z0-9-]+)\.css';/g)].map((m) => m[1]!)
}

const blockOf = (className: string) => className.split(/__|--/)[0]!

/**
 * For each stylesheet, the blocks its rules are written for: the last class
 * of each selector's first compound, so `.dou-popover.dou-popconfirm` counts
 * for Popconfirm only.
 */
function stylesheetBlocks(name: string): Set<string> {
  const css = readFileSync(join(themeSrc, 'components', `${name}.css`), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )
  const blocks = new Set<string>()
  // Selector lines only; nested `&` rules belong to the rule they sit in.
  for (const match of css.matchAll(/^\s*([^@&\s{};][^{};]*)\{/gm)) {
    for (const selector of match[1]!.split(',')) {
      const compound = selector.trim().split(/[\s>+~]/)[0] ?? ''
      const last = [...compound.matchAll(/\.(dou-[a-z0-9_-]+)/g)].at(-1)
      if (last) blocks.add(blockOf(last[1]!))
    }
  }
  return blocks
}

const importPattern =
  /(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"]/g

function resolveImport(from: string, specifier: string): string | undefined {
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
}

/** Every `dou-*` block used by `entry` and whatever it imports from the package. */
function blocksUsedBy(entry: string): Set<string> {
  const blocks = new Set<string>()
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    // Comments mention classes by way of example; only code counts.
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const m of code.matchAll(/useNamespace\(\s*'([a-z0-9-]+)'\s*\)/g))
      blocks.add(`dou-${m[1]}`)
    for (const m of code.matchAll(/\bdou-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9-]+)?/g)) {
      blocks.add(blockOf(m[0]))
    }
    for (const m of code.matchAll(importPattern)) {
      const target = resolveImport(file, (m[1] ?? m[2])!)
      if (target && !target.includes('__tests__')) queue.push(target)
    }
  }
  return blocks
}

/** Component directories mapped to the stylesheets they need, in cascade order. */
export function styleDeps(): Map<string, string[]> {
  const order = stylesheetOrder()
  const sheets = order.map((name) => ({ name, blocks: stylesheetBlocks(name) }))
  const result = new Map<string, string[]>()
  const componentsDir = join(src, 'components')
  for (const dir of readdirSync(componentsDir).toSorted()) {
    const entry = join(componentsDir, dir, 'index.ts')
    if (!existsSync(entry)) continue
    const used = blocksUsedBy(entry)
    result.set(
      dir,
      sheets.filter((sheet) => [...sheet.blocks].some((b) => used.has(b))).map((s) => s.name),
    )
  }
  return result
}
