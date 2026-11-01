/**
 * Build the theme package:
 *   - dist/*.css        bundled & minified stylesheets
 *   - dist/index.js     token API (themeToCss, defineTheme, ...)
 *   - dist/*.d.ts       type declarations
 */
import { rm } from 'node:fs/promises'
import { Glob } from 'bun'

const root = new URL('../', import.meta.url).pathname
const dist = `${root}dist`

await rm(dist, { recursive: true, force: true })
await run(['bun', 'scripts/gen.ts'])

const cssEntries = ['src/index.css', 'src/core.css', 'src/generated/tokens.css']
for await (const file of new Glob('src/components/*.css').scan(root)) cssEntries.push(file)

const css = await Bun.build({
  entrypoints: cssEntries.map((file) => `${root}${file}`),
  root: `${root}src`,
  outdir: dist,
  minify: true,
  naming: '[dir]/[name].[ext]',
})
assertOk(css, 'css')

// tokens.css is exposed at the package root, not under generated/
await Bun.write(`${dist}/tokens.css`, Bun.file(`${dist}/generated/tokens.css`))
await rm(`${dist}/generated`, { recursive: true, force: true })

const js = await Bun.build({
  entrypoints: [`${root}src/index.ts`],
  outdir: dist,
  target: 'browser',
  format: 'esm',
})
assertOk(js, 'js')

await run(['tsc', '-p', 'tsconfig.build.json'])

function assertOk(result: Bun.BuildOutput, label: string) {
  if (result.success) return
  for (const log of result.logs) console.error(log)
  throw new Error(`theme ${label} build failed`)
}

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed`)
}
