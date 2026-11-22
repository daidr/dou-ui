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

  for (const scenario of [
    {
      label: 'scroll near-bottom flips top and clamps to viewport',
      viewport: { width: 640, height: 360 },
      query: { mode: 'scroll', anchor: 'bottom', placement: 'bottom-start' },
      expectedPlacement: 'top-start',
    },
    {
      label: 'scroll near-top clamps below trigger',
      viewport: { width: 640, height: 360 },
      query: { mode: 'scroll', anchor: 'top', placement: 'bottom-start' },
      expectedPlacement: 'bottom-start',
    },
    {
      label: 'scroll side placement uses vertical viewport height',
      viewport: { width: 390, height: 360 },
      query: { mode: 'scroll', anchor: 'side', placement: 'right' },
      expectedPlacement: 'right',
    },
    {
      label: 'scroll respects maxHeight prop',
      viewport: { width: 640, height: 844 },
      query: { mode: 'scroll', anchor: 'top', placement: 'bottom-start', maxHeight: '180' },
      expectedPlacement: 'bottom-start',
      expectedMaxHeight: 180,
    },
  ]) {
    const page = await browser.newPage({
      viewport: scenario.viewport,
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const query = new URLSearchParams(scenario.query)
    await page.goto(`http://127.0.0.1:${address.port}/popover-layout.html?${query}`)
    await page.locator('#show').click()
    await page.locator('.dou-popover').waitFor({ state: 'visible' })
    const metrics = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      const panel = document.querySelector('.dou-popover')
      const title = panel.querySelector('.dou-popover__title')
      const content = panel.querySelector('.dou-popover__content')
      const rect = panel.getBoundingClientRect()
      const titleBefore = title.getBoundingClientRect().top
      content.scrollTop = 120
      const titleAfter = title.getBoundingClientRect().top
      return {
        placement: panel.dataset.placement,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        available: parseFloat(panel.style.getPropertyValue('--dou-floating-available')),
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight,
        scrollTop: content.scrollTop,
        titlePinned: Math.abs(titleBefore - titleAfter) < 0.5,
      }
    })
    assert.equal(metrics.placement, scenario.expectedPlacement, scenario.label)
    assert.ok(
      metrics.top >= 7.5 && metrics.bottom <= scenario.viewport.height - 7.5,
      `${scenario.label}: outside viewport (${metrics.top}..${metrics.bottom})`,
    )
    const ceiling = scenario.expectedMaxHeight
      ? Math.min(scenario.expectedMaxHeight, metrics.available)
      : metrics.available
    assert.ok(
      metrics.height <= ceiling + 1,
      `${scenario.label}: height ${metrics.height} exceeded ${ceiling}`,
    )
    if (scenario.query.anchor === 'side') {
      assert.ok(
        metrics.available >= scenario.viewport.height - 20,
        `${scenario.label}: side placement available ${metrics.available} was not vertical room`,
      )
    }
    assert.ok(
      metrics.scrollHeight > metrics.clientHeight,
      `${scenario.label}: content did not become scrollable`,
    )
    assert.ok(metrics.scrollTop > 0, `${scenario.label}: content could not scroll`)
    assert.ok(metrics.titlePinned, `${scenario.label}: title did not stay pinned while scrolling`)
    assert.deepEqual(errors, [], scenario.label)
    process.stdout.write(`PASS ${scenario.label}\n`)
    await page.close()
  }

  // Re-opening after moving a trigger from top to bottom must measure natural
  // height and flip upward rather than staying trapped in the tiny bottom room.
  {
    const label = 'scroll reopen near-bottom flips upward'
    const page = await browser.newPage({
      viewport: { width: 640, height: 480 },
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const query = new URLSearchParams({
      mode: 'scroll',
      anchor: 'top',
      placement: 'bottom-start',
      maxHeight: '220',
    })
    await page.goto(`http://127.0.0.1:${address.port}/popover-layout.html?${query}`)
    await page.locator('#show').click()
    await page.locator('.dou-popover').waitFor({ state: 'visible' })
    await page.locator('#show').click()
    await page.locator('.dou-popover').waitFor({ state: 'hidden' })
    await page.locator('#move-bottom').click()
    await page.locator('#show').click()
    await page.locator('.dou-popover').waitFor({ state: 'visible' })
    const metrics = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      const panel = document.querySelector('.dou-popover')
      const rect = panel.getBoundingClientRect()
      return {
        placement: panel.dataset.placement,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
      }
    })
    assert.equal(metrics.placement, 'top-start', label)
    assert.ok(metrics.height >= 218 && metrics.height <= 222, `${label}: got ${metrics.height}`)
    assert.ok(metrics.top >= 7.5 && metrics.bottom <= 480 - 7.5, label)
    assert.deepEqual(errors, [], label)
    process.stdout.write(`PASS ${label}\n`)
    await page.close()
  }
} finally {
  await browser?.close()
  await server.close()
}
