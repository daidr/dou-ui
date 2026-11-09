// 逐帧记录一组元素的位置、高度、宽度、缩放和透明度，找出肉眼能看出的单帧跳变，供 dou-pr-review 使用。
// 用法（Playwright）：
//   await page.addScriptTag({ path: '.claude/skills/dou-pr-review/frames.js' })
//   await page.evaluate(() => window.douFrames.start('.dou-toast__item', (el) => el.textContent.slice(0, 4)))
//   ……触发要测的操作（新增、关闭、展开、收起，以及它们互相打断）……
//   const { jumps, maxStep } = await page.evaluate(() => window.douFrames.stop())
// 第二个参数给每个元素一个稳定的名字（同名元素会被当成同一个）；不给就用出现顺序。
// 跳变：某一帧的变化超过阈值，并且比前后两帧的变化都大 2.5 倍以上。过渡正常开始、
// 中途改目标不会被算进去；从错误的起点开始、瞬间换到别的值会被算进去。
// stop() 的第一个参数可以改阈值：{ top: 8, left: 8, width: 6, height: 6, scale: 0.02, opacity: 0.3 }。
// 刚出现的元素第一帧不算（进场动画从它自己的起点开始）。
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
      state = { samples: [], running: true }
      const loop = () => {
        if (!state.running) return
        const items = {}
        for (const el of document.querySelectorAll(selector)) {
          if (!names.has(el)) names.set(el, nameOf ? nameOf(el) : `#${++next}`)
          items[names.get(el)] = read(el)
        }
        state.samples.push({ t: performance.now(), items })
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
      const step = (i, id, key) => {
        const a = samples[i - 1]?.items[id]
        const b = samples[i]?.items[id]
        return a && b ? b[key] - a[key] : 0
      }
      for (let i = 1; i < samples.length; i++) {
        for (const id of Object.keys(samples[i].items)) {
          if (!samples[i - 1].items[id]) continue
          if (!samples[i - 2]?.items[id] && i > 1) continue // first frame after it appeared
          for (const key of KEYS) {
            const d = step(i, id, key)
            maxStep[key] = Math.max(maxStep[key] ?? 0, Math.abs(d))
            const around = Math.max(Math.abs(step(i - 1, id, key)), Math.abs(step(i + 1, id, key)))
            if (Math.abs(d) > lim[key] && Math.abs(d) > 2.5 * around) {
              const from = samples[i - 1].items[id][key]
              jumps.push({
                id,
                key,
                from: Math.round(from * 1000) / 1000,
                to: Math.round((from + d) * 1000) / 1000,
                at: Math.round(samples[i].t - t0),
              })
            }
          }
        }
      }
      return { frames: samples.length, jumps, maxStep, samples }
    },
  }
}
