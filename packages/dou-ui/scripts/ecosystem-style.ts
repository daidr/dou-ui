/**
 * Build the stylesheets of a package built on `dou-ui` (`@dou-ui/chart`
 * and the others):
 *
 * - `dist/style.css`: the package's own styles, bundled and minified.
 * - `dist/style.js`: `@dou-ui/<name>/style`, which imports the style entries
 *   of the `dou-ui` components the package uses and then `style.css`, so
 *   the package can be styled on its own without the full stylesheet.
 */
import { styleDirsFor } from './style-deps'

export async function buildPackageStyle(packageRoot: URL) {
  const result = await Bun.build({
    entrypoints: [new URL('src/style.css', packageRoot).pathname],
    outdir: new URL('dist', packageRoot).pathname,
    minify: true,
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    process.exit(1)
  }

  const lines = [
    ...styleDirsFor(new URL('src', packageRoot).pathname).map(
      (dir) => `import 'dou-ui/components/${dir}/style'`,
    ),
    "import './style.css'",
    '',
  ]
  await Bun.write(new URL('dist/style.js', packageRoot), lines.join('\n'))
  // side-effect only; the declaration keeps strict side-effect import checks happy
  await Bun.write(new URL('dist/style.d.ts', packageRoot), 'export {}\n')
}
