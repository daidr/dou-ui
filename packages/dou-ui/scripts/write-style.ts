/**
 * Write `dist/components/<dir>/style.js` for every component: an import of
 * the core stylesheet plus each stylesheet the component needs, so a single
 * `import 'dou-ui/components/select/style'` styles it on its own.
 */
import { mkdir } from 'node:fs/promises'
import { styleDeps } from './style-deps'

const dist = new URL('../dist/components/', import.meta.url)

for (const [dir, sheets] of styleDeps()) {
  const lines = [
    "import '@dou-ui/theme/core.css'",
    ...sheets.map((sheet) => `import '@dou-ui/theme/components/${sheet}.css'`),
    '',
  ]
  const target = new URL(`${dir}/`, dist)
  await mkdir(target, { recursive: true })
  await Bun.write(new URL('style.js', target), lines.join('\n'))
}
