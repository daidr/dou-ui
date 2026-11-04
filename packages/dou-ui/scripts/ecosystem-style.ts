/**
 * Build the stylesheets of a package built on `dou-ui` (`@dou-ui/chart`
 * and the others):
 *
 * - `dist/style.css`: the package's own styles, bundled and minified.
 * - `dist/style.js`: `@dou-ui/<name>/style`, which imports the style entries
 *   of the `dou-ui` components the package uses and then `style.css`, so
 *   the package can be styled on its own without the full stylesheet. It
 *   covers the subpaths without a style entry of their own too
 *   (`@dou-ui/flow/whiteboard`, which shows a toast).
 * - `dist/<subpath>/style.js` for each subpath that exports components
 *   (`@dou-ui/form-builder/renderer/style`): the same for what that entry
 *   reaches, with the subpath's own `style.css` when it has one, else the
 *   package's.
 */
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { reachableFiles, styleDirsFor } from './style-deps'

/** The subpaths of a package (`renderer`) whose entry exports components. */
export function componentSubpaths(packageRoot: URL): string[] {
  const { exports = {} } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'))
  return Object.keys(exports)
    .filter((key) => /^\.\/[a-z-]+$/.test(key) && !['./style', './style.css'].includes(key))
    .map((key) => key.slice(2))
    .filter((subpath) => {
      const index = new URL(`src/${subpath}/index.ts`, packageRoot)
      return existsSync(index) && /withInstall\(/.test(readFileSync(index, 'utf8'))
    })
}

/**
 * What `dist/style.js` covers: `src/index.ts` and the index of every other
 * JS subpath (`whiteboard`, `collaboration`) that has no style entry itself,
 * `src/index.ts` first.
 */
export function mainStyleEntries(packageRoot: URL): string[] {
  const { exports = {} } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'))
  const own = new Set(componentSubpaths(packageRoot))
  const subpaths = Object.keys(exports)
    .filter((key) => /^\.\/[a-z-]+$/.test(key) && !['./style', './style.css'].includes(key))
    .map((key) => key.slice(2))
    .filter((subpath) => !own.has(subpath))
  return [
    new URL('src/index.ts', packageRoot),
    ...subpaths.map((subpath) => new URL(`src/${subpath}/index.ts`, packageRoot)),
  ]
    .filter((url) => existsSync(url))
    .map((url) => fileURLToPath(url))
}

async function bundleCss(entry: URL, outdir: URL) {
  const result = await Bun.build({
    entrypoints: [fileURLToPath(entry)],
    outdir: fileURLToPath(outdir),
    minify: true,
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    process.exit(1)
  }
}

/** The other packages built on `dou-ui` an entry imports (`@dou-ui/code`). */
function packagesUsedBy(entries: string[], self: string): string[] {
  const used = new Set<string>()
  for (const file of new Set(entries.flatMap((entry) => reachableFiles(entry)))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/from\s+['"](@dou-ui\/[a-z-]+)['"/]/g)) {
      const name = m[1]!
      if (name !== self && !['@dou-ui/icons', '@dou-ui/theme'].includes(name)) used.add(name)
    }
  }
  return [...used].toSorted()
}

async function writeEntry(target: URL, entries: string[], css: string, self: string) {
  const lines = [
    ...styleDirsFor(entries).map((dir) => `import 'dou-ui/components/${dir}/style'`),
    // Components of another package, e.g. the code input in a formula bar.
    // Only from the first entry: a subpath may adapt an optional package
    // (`@dou-ui/editor/code`) the user need not install.
    ...packagesUsedBy(entries.slice(0, 1), self).map((name) => `import '${name}/style'`),
    `import '${css}'`,
    '',
  ]
  await mkdir(new URL('./', target), { recursive: true })
  await Bun.write(target, lines.join('\n'))
  // side-effect only; the declaration keeps strict side-effect import checks happy
  await Bun.write(new URL(target.href.replace(/\.js$/, '.d.ts')), 'export {}\n')
}

export async function buildPackageStyle(packageRoot: URL) {
  const { name } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'))
  await bundleCss(new URL('src/style.css', packageRoot), new URL('dist', packageRoot))
  await writeEntry(
    new URL('dist/style.js', packageRoot),
    mainStyleEntries(packageRoot),
    './style.css',
    name,
  )
  for (const subpath of componentSubpaths(packageRoot)) {
    const ownCss = new URL(`src/${subpath}/style.css`, packageRoot)
    if (existsSync(ownCss)) await bundleCss(ownCss, new URL(`dist/${subpath}`, packageRoot))
    await writeEntry(
      new URL(`dist/${subpath}/style.js`, packageRoot),
      [fileURLToPath(new URL(`src/${subpath}/index.ts`, packageRoot))],
      existsSync(ownCss) ? './style.css' : '../style.css',
      name,
    )
  }
}
