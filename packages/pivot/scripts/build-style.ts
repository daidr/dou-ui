// Ship the pivot's stylesheet as `@dou-ui/pivot/style.css`, bundled and minified.
const result = await Bun.build({
  entrypoints: [new URL('../src/style.css', import.meta.url).pathname],
  outdir: new URL('../dist', import.meta.url).pathname,
  minify: true,
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
