// Ship the full stylesheet as `dou-ui/style.css` so users only need one package.
const source = Bun.file(new URL('../../theme/dist/index.css', import.meta.url))
if (!(await source.exists())) {
  throw new Error('@dou-ui/theme is not built yet. Run `bun run build` from the repository root.')
}
await Bun.write(new URL('../dist/style.css', import.meta.url), source)
