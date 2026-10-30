// Runs every case in Chromium and prints the median of several runs.
// Usage: bun run bench [case...] [--n=1000,10000] [--runs=5] [--json=out.json]
// Needs Playwright with Chromium: `bun add -g playwright && playwright install chromium`.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')

const dist = fileURLToPath(new URL('./dist', import.meta.url))
const args = process.argv.slice(2)
const flag = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const sizes = flag('n', '1000').split(',').map(Number)
const runs = Number(flag('runs', 5))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  try {
    const body = await readFile(join(dist, path === '/' ? 'index.html' : path))
    res.writeHead(200, { 'content-type': types[extname(path) || '.html'] ?? 'text/plain' })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(0)
const base = `http://localhost:${server.address().port}/`

const source = await readFile(fileURLToPath(new URL('./src/cases.ts', import.meta.url)), 'utf8')
const all = [...source.matchAll(/^  '?([\w-]+)'?: \{$/gm)].map((match) => match[1])
const names = args.filter((arg) => !arg.startsWith('--'))
const selected = names.length ? all.filter((name) => names.includes(name)) : all

const browser = await chromium.launch()
const median = (list) => {
  const sorted = list.filter((x) => x != null).toSorted((a, b) => a - b)
  return sorted.length ? sorted[sorted.length >> 1] : null
}
const fmt = (x) => (x == null ? '-' : x.toFixed(1))
const results = []
const print = (line) => process.stdout.write(`${line}\n`)
print('case\tn\tmount ms\tact ms\tact js ms\tnodes\theap MB')
for (const name of selected) {
  for (const n of sizes) {
    const mounts = []
    const acts = []
    const scripts = []
    let nodes = 0
    let heap = 0
    for (let run = 0; run < runs; run++) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`${base}?case=${name}&n=${n}`)
      await page.waitForFunction(() => window.bench)
      mounts.push(await page.evaluate(() => window.bench.mount()))
      acts.push(await page.evaluate(() => window.bench.act()))
      scripts.push(await page.evaluate(() => window.bench.script()))
      nodes = await page.evaluate(() => window.bench.nodes())
      const client = await page.context().newCDPSession(page)
      await client.send('HeapProfiler.collectGarbage')
      const { usedSize } = await client.send('Runtime.getHeapUsage')
      heap = usedSize / 1048576
      if (errors.length) console.error(name, n, errors[0])
      await page.close()
    }
    const row = {
      name,
      n,
      mount: median(mounts),
      act: median(acts),
      script: median(scripts),
      nodes,
      heap,
    }
    results.push(row)
    print(
      [name, n, fmt(row.mount), fmt(row.act), fmt(row.script), nodes, heap.toFixed(1)].join('\t'),
    )
  }
}
await browser.close()
server.close()
if (flag('json')) {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(flag('json'), JSON.stringify(results, null, 2))
}
