import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'

const root = fileURLToPath(new URL('../', import.meta.url))

await rm(`${root}dist`, { recursive: true, force: true })
await run(['bun', 'scripts/gen.ts'])

const js = await Bun.build({
  entrypoints: [`${root}src/index.ts`],
  outdir: `${root}dist`,
  target: 'node',
  format: 'esm',
})
if (!js.success) {
  for (const log of js.logs) console.error(log)
  throw new Error('resolver build failed')
}

await run(['tsc', '-p', 'tsconfig.build.json'])

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed`)
}
