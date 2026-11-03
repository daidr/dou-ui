import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'

const root = fileURLToPath(new URL('../', import.meta.url))

await rm(`${root}dist`, { recursive: true, force: true })

const js = await Bun.build({
  entrypoints: [`${root}src/module.ts`],
  outdir: `${root}dist`,
  target: 'node',
  format: 'esm',
  packages: 'external',
})
if (!js.success) {
  for (const log of js.logs) console.error(log)
  throw new Error('nuxt module build failed')
}

const tsc = Bun.spawn(['tsc', '-p', 'tsconfig.build.json'], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
})
if ((await tsc.exited) !== 0) throw new Error('tsc failed')
