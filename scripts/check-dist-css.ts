/**
 * Fail when a published stylesheet uses `light-dark()`.
 *
 * Components take their light and dark values from the `--dou-scheme-dark`
 * token, never from `color-scheme`: bundlers lower `light-dark()` into
 * custom properties that only switch on where `color-scheme` is declared,
 * which left the default light theme on `:root` without those values. The
 * source is checked by a test; this catches anything a build step adds.
 * Run after `bun run build`.
 */
import { Glob } from 'bun'

const root = new URL('../', import.meta.url).pathname
// Bun still writes the `--buncss-light/dark` switches next to each `color-scheme`; only reading them matters.
const forbidden = /light-dark\(|var\(--[a-z]+css-(?:light|dark)\b/
const problems: string[] = []
let checked = 0

for await (const file of new Glob('packages/*/dist/**/*.css').scan(root)) {
  checked++
  const match = (await Bun.file(`${root}${file}`).text()).match(forbidden)
  if (match) problems.push(`${file}: contains ${match[0]}`)
}

if (checked === 0) {
  console.error('No stylesheets under packages/*/dist; run `bun run build` first.')
  process.exit(1)
}
if (problems.length) {
  console.error('Published stylesheets depend on color-scheme; use --dou-scheme-dark instead:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
process.stdout.write(`checked ${checked} stylesheets: no light-dark()\n`)
