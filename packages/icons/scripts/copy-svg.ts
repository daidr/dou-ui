// Ship the source drawings as `@dou-ui/icons/svg/<name>.svg` for use outside Vue.
import { mkdir, readdir } from 'node:fs/promises'

const source = new URL('../icons/', import.meta.url)
const outDir = new URL('../dist/svg/', import.meta.url)

await mkdir(outDir, { recursive: true })
for (const file of await readdir(source)) {
  const match = file.match(/^(.+)\.(\w+)\.svg$/)
  if (!match) continue
  const [, name, variant] = match
  const target = variant === 'stroke' ? `${name}.svg` : `${name}-${variant}.svg`
  const svg = await Bun.file(new URL(file, source)).text()
  // Dots are drawn a little heavier than lines, as the components draw them.
  await Bun.write(
    new URL(target, outDir),
    svg
      .replaceAll('class="dot"', 'stroke-width="2.25"')
      .replaceAll('class="fill"', 'fill="currentColor"'),
  )
}
