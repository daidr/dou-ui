import { createApp, nextTick } from 'vue'
import 'dou-ui/style.css'
import { cases } from './cases'

const settle = async () => {
  await nextTick()
  await nextTick()
  // Force style and layout, so their cost is counted.
  document.body.getBoundingClientRect()
}

const frame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))

// One case per page load: `?case=select&n=1000`.
const params = new URLSearchParams(location.search)
const name = params.get('case')!
const n = Number(params.get('n') ?? 1000)
const entry = cases[name]!

;(window as any).bench = {
  async mount() {
    const root = document.getElementById('app')!
    const render = entry.render(n)
    const start = performance.now()
    createApp({ render }).mount(root)
    await settle()
    const time = performance.now() - start
    await frame()
    return time
  },
  async act() {
    if (!entry.act) return null
    const root = document.getElementById('app')!
    await entry.prepare?.(root)
    await frame()
    const start = performance.now()
    await entry.act(root)
    await nextTick()
    await nextTick()
    ;(window as any).scriptTime = performance.now() - start
    await settle()
    // Work deferred by a zero timeout, e.g. a debounce of 0.
    await new Promise((resolve) => setTimeout(resolve))
    await settle()
    const time = performance.now() - start
    await frame()
    return time
  },
  script: () => (window as any).scriptTime ?? null,
  nodes: () => document.getElementsByTagName('*').length,
}
