// 逐帧记录一组元素的位置、高度、宽度、缩放和透明度，找出肉眼能看出的单帧跳变，供 dou-pr-review 使用。
// 用法（Playwright）：
//   await page.addScriptTag({ path: '.claude/skills/dou-pr-review/frames.js' })
//   await page.evaluate(() => window.douFrames.start('.dou-toast__item'))
//   ……触发要测的操作（新增、关闭、展开、收起，以及它们互相打断）……
//   const { jumps, maxStep } = await page.evaluate(() => window.douFrames.stop())
// 元素按出现顺序命名（#1、#2……），同一个元素一直用同一个名字。第二个参数可以自己给名字，
// 但只在每个元素的名字都不同时才传：同名的元素会被当成同一个，报出大量假跳变。
// 跳变：某个属性的一次变化超过阈值，并且比它前后两次变化都大 2.5 倍以上。过渡正常开始、
// 中途改目标不会被算进去；从错误的起点开始、瞬间换到别的值会被算进去。
// 浏览器有时两帧才更新一次某个属性，所以先去掉连续重复的值，再拿每次变化和相邻的变化比。
// stop() 的第一个参数可以改阈值：{ top: 8, left: 8, width: 6, height: 6, scale: 0.02, opacity: 0.3 }。
// 刚出现的元素第一次变化不算（进场动画从它自己的起点开始）。
// 位置是相对窗口的（getBoundingClientRect），录制期间不要滚动页面，否则所有元素都会报跳变。
// 只能在 Playwright 的 Chromium 里逐帧测；iOS Safari 上是否连贯，仍要在报告里列给用户确认。
// 用块作用域包住辅助函数，重复注入同一页面时不会因重名报错。
/* oxlint-disable unicorn/consistent-function-scoping */
{
  const KEYS = ['top', 'bottom', 'left', 'width', 'height', 'scale', 'opacity']
  const read = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const scale = s.scale === 'none' ? 1 : Number.parseFloat(s.scale)
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      width: el.offsetWidth,
      height: el.offsetHeight,
      scale,
      opacity: Number(s.opacity),
    }
  }
  let state

  globalThis.douFrames = {
    start(selector, nameOf) {
      const names = new WeakMap()
      let next = 0
      // a loop still running from an earlier start() stops at its next frame
      if (state) state.running = false
      const own = { samples: [], running: true }
      state = own
      const loop = () => {
        if (!own.running) return
        const items = {}
        for (const el of document.querySelectorAll(selector)) {
          if (!names.has(el)) names.set(el, nameOf ? nameOf(el) : `#${++next}`)
          items[names.get(el)] = read(el)
        }
        own.samples.push({ t: performance.now(), items })
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    stop(limits = {}) {
      state.running = false
      const lim = {
        top: 8,
        bottom: 8,
        left: 8,
        width: 6,
        height: 6,
        scale: 0.02,
        opacity: 0.3,
        ...limits,
      }
      const { samples } = state
      const t0 = samples[0]?.t ?? 0
      const jumps = []
      const maxStep = {}
      // Each element's values per property, with repeats dropped: a frame
      // where the browser has not updated the property yet is not a step.
      const series = new Map()
      for (const sample of samples) {
        for (const [id, item] of Object.entries(sample.items)) {
          for (const key of KEYS) {
            const name = `${id} ${key}`
            if (!series.has(name)) series.set(name, { id, key, values: [] })
            const { values } = series.get(name)
            if (values.at(-1)?.v !== item[key]) values.push({ v: item[key], t: sample.t })
          }
        }
      }
      const present = new Set(Object.keys(samples[0]?.items ?? {}))
      for (const { id, key, values } of series.values()) {
        const step = (i) => (i > 0 && i < values.length ? values[i].v - values[i - 1].v : 0)
        // an element that appeared while recording starts from its own entry
        const first = present.has(id) ? 1 : 2
        for (let i = first; i < values.length; i++) {
          const d = step(i)
          maxStep[key] = Math.max(maxStep[key] ?? 0, Math.abs(d))
          const around = Math.max(Math.abs(step(i - 1)), Math.abs(step(i + 1)))
          if (Math.abs(d) > lim[key] && Math.abs(d) > 2.5 * around) {
            const round = (n) => Math.round(n * 1000) / 1000
            jumps.push({
              id,
              key,
              from: round(values[i - 1].v),
              to: round(values[i].v),
              at: Math.round(values[i].t - t0),
            })
          }
        }
      }
      return { frames: samples.length, jumps, maxStep, samples }
    },
  }
}
