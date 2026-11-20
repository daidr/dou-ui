// Real layout is required: DOM emulators cannot reproduce shrink-to-fit feedback.
// Uses the same source aliases as the playground. CI installs Chromium for bench.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({
  configFile: `${root}playground/vite.config.ts`,
  root: `${root}test/browser`,
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
})
let browser
try {
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  for (const viewportWidth of [1258, 390, 320]) {
    for (const edge of ['left', 'right']) {
      for (const width of ['', '320', '20rem', '50%']) {
        const page = await browser.newPage({
          viewport: { width: viewportWidth, height: 844 },
          reducedMotion: 'reduce',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        const placement = edge === 'left' ? 'bottom-start' : 'bottom-end'
        const query = new URLSearchParams({ edge, placement, width })
        await page.goto(`http://127.0.0.1:${address.port}/popover-layout.html?${query}`)
        await page.locator('#show').click()
        await page.locator('.dou-popover').waitFor({ state: 'visible' })
        const label = `${viewportWidth}px ${edge} width=${width || 'auto'}`
        // Dispatch inside the page to keep the popover open while updating its slot.
        for (const content of ['long', 'short', 'long']) {
          const frames = await page.evaluate(async (id) => {
            const panel = document.querySelector('.dou-popover')
            const resized = new Promise((resolve) => {
              const observer = new ResizeObserver(() => {
                observer.disconnect()
                // Let Vue flush positioning updates from this layout's observers,
                // before the browser paints or runs another animation frame.
                queueMicrotask(resolve)
              })
              observer.observe(panel)
            })
            document.getElementById(id).click()
            await resized
            const samples = []
            const first = panel.getBoundingClientRect()
            samples.push({ width: panel.offsetWidth, left: first.left, right: first.right })
            for (let i = 0; i < 16; i++) {
              await new Promise(requestAnimationFrame)
              const rect = panel.getBoundingClientRect()
              samples.push({ width: panel.offsetWidth, left: rect.left, right: rect.right })
            }
            return samples
          }, content)
          assert.equal(
            new Set(frames.map((frame) => frame.width)).size,
            1,
            `${label} ${content}: width changed between frames`,
          )
          const last = frames.at(-1)
          assert.ok(
            frames.every((frame) => frame.left >= 7.5 && frame.right <= viewportWidth - 7.5),
            `${label} ${content}: outside viewport before positioning settles`,
          )
          if (width === '320' || width === '20rem')
            assert.equal(last.width, Math.min(320, viewportWidth - 16), label)
          if (width === '50%') assert.equal(last.width, Math.min(360, viewportWidth / 2), label)
          if (!width && content === 'long')
            assert.equal(last.width, Math.min(360, viewportWidth - 16), label)
          if (!width && content === 'short') assert.ok(last.width < 100, label)
        }
        assert.deepEqual(errors, [], label)
        process.stdout.write(`PASS ${label}\n`)
        await page.close()
      }
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
