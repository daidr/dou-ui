/**
 * Fail when a published stylesheet lost native `light-dark()`.
 *
 * Lowering it turns each value into custom properties (`--buncss-light`,
 * `--lightningcss-light`, ...) that are only defined where the bundler saw a
 * `color-scheme` declaration, which leaves the default light theme without
 * those values. Run after `bun run build`.
 */
import { Glob } from 'bun'

const root = new URL('../', import.meta.url).pathname
const lowered = /--[a-z]+css-(?:light|dark)\b/
const problems: string[] = []
let checked = 0

for await (const file of new Glob('packages/*/dist/**/*.css').scan(root)) {
  checked++
  const css = await Bun.file(`${root}${file}`).text()
  const match = css.match(lowered)
  if (match) problems.push(`${file}: contains ${match[0]}`)
}

if (checked === 0) {
  console.error('No stylesheets under packages/*/dist; run `bun run build` first.')
  process.exit(1)
}
if (problems.length) {
  console.error('light-dark() was lowered in published stylesheets:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
process.stdout.write(`checked ${checked} stylesheets: light-dark() kept as written\n`)
