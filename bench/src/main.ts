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
    if (!entry.frames) return once()
    await once()
    const times: number[] = []
    for (let i = 0; i < entry.frames; i++) times.push(await once())
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own array
    times.sort((a, b) => a - b)
    return times[times.length >> 1]!
  },
  script: () => (window as any).scriptTime ?? null,
  budget: () => entry.budget ?? null,
  nodes: () => document.getElementsByTagName('*').length,
}

async function once(): Promise<number> {
  const root = document.getElementById('app')!
  await entry.prepare?.(root)
  await frame()
  const start = performance.now()
  await entry.act!(root)
  await nextTick()
  await nextTick()
  ;(window as any).scriptTime = performance.now() - start
  await settle()
  // Work deferred by a zero timeout, e.g. a debounce of 0.
  await new Promise((resolve) => setTimeout(resolve))
  await settle()
  // a case that waits for a frame says how long its own work took in it
  const time = (window as any).workTime ?? performance.now() - start
  await frame()
  return time
}
