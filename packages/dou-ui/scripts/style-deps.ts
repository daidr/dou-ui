/**
 * Work out which stylesheets each component needs, so it can be styled on
 * its own: `dou-ui/components/<dir>/style` imports exactly those.
 *
 * A component needs every stylesheet that styles a class it (or anything it
 * imports, followed transitively) renders. Classes are read from
 * `useNamespace('<block>')` calls and `dou-*` literals in the source.
 */
import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../src')
const themeSrc = resolve(here, '../../theme/src')

/** Component stylesheets in the cascade order of the full stylesheet. */
export function stylesheetOrder(): string[] {
  const index = readFileSync(join(themeSrc, 'index.css'), 'utf8')
  return [...index.matchAll(/@import '\.\/components\/([a-z0-9-]+)\.css';/g)].map((m) => m[1]!)
}

const blockOf = (className: string) => className.split(/__|--/)[0]!

/**
 * For each stylesheet, the blocks its rules are written for, read from each
 * selector's first compound. A compound with several classes counts for one
 * of them: the stylesheet's own block, else one written as an element or a
 * modifier, else the last. So `.dou-popover.dou-popconfirm` counts for
 * Popconfirm only, and `.dou-chat-input__submit.dou-button` for ChatInput
 * only.
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
      const classes = [...compound.matchAll(/\.(dou-[a-z0-9_-]+)/g)].map((m) => m[1]!)
      const own =
        classes.find((c) => blockOf(c) === `dou-${name}`) ??
        classes.find((c) => /__|--/.test(c)) ??
        classes.at(-1)
      if (own) blocks.add(blockOf(own))
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

const stripComments = (code: string) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** Every name `dou-ui` exports from a component directory, mapped to that directory. */
function exportDirs(): Map<string, string> {
  const result = new Map<string, string>()
  const componentsDir = join(src, 'components')
  for (const dir of readdirSync(componentsDir).toSorted()) {
    const entry = join(componentsDir, dir, 'index.ts')
    if (!existsSync(entry)) continue
    const code = stripComments(readFileSync(entry, 'utf8'))
    for (const m of code.matchAll(/^export (?:const|function|class) ([A-Za-z0-9_$]+)/gm)) {
      result.set(m[1]!, dir)
    }
    for (const m of code.matchAll(/^export \{([^}]*)\}/gm)) {
      for (const part of m[1]!.split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .at(-1)!
        if (name && !name.startsWith('type ')) result.set(name, dir)
      }
    }
  }
  return result
}

const dynamicImportPattern = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g

/** `entry` and every file of its package it imports, followed transitively. */
export function reachableFiles(entry: string): string[] {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const m of [...code.matchAll(importPattern), ...code.matchAll(dynamicImportPattern)]) {
      const target = resolveImport(file, (m[1] ?? m[2])!)
      if (target && /\.(ts|vue)$/.test(target) && !target.includes('__tests__')) queue.push(target)
    }
  }
  return [...seen]
}

/**
 * The component directories of `dou-ui` whose style entries an entry of a
 * package built on it needs (`src/index.ts`, `src/renderer/index.ts`): those
 * of the components and functions it imports from `dou-ui`, and of the
 * `dou-*` classes it writes itself, in every file the entry reaches. Entries
 * already covered by another one are left out; the rest keep the cascade
 * order. Several entries are read as one (a package's main style entry
 * also covers its subpaths without their own).
 */
export function styleDirsFor(entry: string | string[]): string[] {
  const exported = exportDirs()
  const deps = styleDeps()
  const order = stylesheetOrder()
  const sheetOf = new Map<string, string>()
  for (const name of order) for (const block of stylesheetBlocks(name)) sheetOf.set(block, name)

  const dirs = new Set<string>()
  const sheets = new Set<string>()
  const files = new Set([entry].flat().flatMap((one) => reachableFiles(one)))
  for (const file of files) {
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const m of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]dou-ui['"]/g)) {
      if (/^import\s+type\s/.test(m[0])) continue
      for (const part of m[1]!.split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0]!
        const dir = name.startsWith('type ') ? undefined : exported.get(name)
        if (dir) dirs.add(dir)
      }
    }
    for (const m of code.matchAll(/\bdou-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9-]+)?/g)) {
      const sheet = sheetOf.get(blockOf(m[0]))
      if (sheet) sheets.add(sheet)
    }
  }
  // A class written by hand brings the entry of the component it belongs to.
  for (const sheet of sheets) {
    if (deps.has(sheet)) dirs.add(sheet)
    else {
      const dir = [...deps].find(([, needs]) => needs.includes(sheet))?.[0]
      if (dir) dirs.add(dir)
    }
  }

  const covered = (dir: string) =>
    [...dirs].some(
      (other) =>
        other !== dir &&
        deps.get(dir)!.every((sheet) => deps.get(other)!.includes(sheet)) &&
        // Of two entries that cover each other, keep the first by name.
        (deps.get(other)!.length > deps.get(dir)!.length || other < dir),
    )
  const position = (dir: string) => {
    const index = order.indexOf(dir)
    return index >= 0 ? index : Math.max(...deps.get(dir)!.map((sheet) => order.indexOf(sheet)))
  }
  return [...dirs].filter((dir) => !covered(dir)).toSorted((a, b) => position(a) - position(b))
}
