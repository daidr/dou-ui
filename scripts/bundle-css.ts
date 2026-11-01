/**
 * Bundle and minify a stylesheet for publishing.
 *
 * The styles rely on native `light-dark()`, which resolves against the
 * `color-scheme` set by `[data-dou-theme]` (and is light where none is set).
 * Lowering it for older browsers rewrites each value into custom properties
 * that are switched on only where `color-scheme` is declared. Bun always
 * lowers it, so the stylesheets are bundled with lightningcss for targets that
 * all support `light-dark()`, and it ships as written; older syntax is still
 * prefixed or lowered for them. A user's bundler may lower it again (Vite does
 * by default), which is why the tokens declare `color-scheme` on `:root` too.
 */
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { bundleAsync, type Targets } from 'lightningcss'

const version = (major: number, minor = 0) => (major << 16) | (minor << 8)

/** The first releases that support `light-dark()`. */
export const cssTargets: Targets = {
  chrome: version(123),
  edge: version(123),
  firefox: version(120),
  safari: version(17, 5),
  ios_saf: version(17, 5),
}

/** Bundle the `@import`s of `entry` and write the minified result to `outfile`. */
export async function bundleCss(entry: string, outfile: string): Promise<void> {
  const { code, warnings } = await bundleAsync({
    filename: entry,
    minify: true,
    targets: cssTargets,
  })
  for (const warning of warnings) console.warn(`${warning.loc.filename}: ${warning.message}`)
  await mkdir(dirname(outfile), { recursive: true })
  await Bun.write(outfile, code)
}
