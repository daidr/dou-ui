// 逐帧记录一组元素的位置、高度、宽度、缩放和透明度，列出可能是单帧跳变的地方，供 dou-pr-review 使用。
// 用法（Playwright）：
//   await page.addScriptTag({ path: '.claude/skills/dou-pr-review/frames.js' })
//   await page.evaluate(() => window.douFrames.start('.dou-toast__item'))
//   ……触发要测的操作（新增、关闭、展开、收起，以及它们互相打断）……
//   const { jumps, maxStep } = await page.evaluate(() => window.douFrames.stop())
// 元素按出现顺序命名（#1、#2……），同一个元素一直用同一个名字。第二个参数可以自己给名字，
// 但只在每个元素的名字都不同时才传：同名的元素会被当成同一个，报出大量假跳变。
// 候选跳变：某个属性的一次变化超过阈值，并且比它前后两次变化都大 2.5 倍以上。
// jumps 只是候选：过渡刚开始就被下一个操作改了目标时，过渡本身一帧走得很快，也会被列出来，
// 数值上和真跳变分不开。例：main 上手机宽度每 60ms 新增一条轻提示，列出 `#1 bottom 67.2→82.2`，
// around 是 [63, 67.2, 82.2, 83.8, 81.3, 81]；真跳变（#403 之前收起时）是 [75, 138, 138.9, 142.3, 144.8]。
// 所以有候选时要把动画放慢到 0.1 倍，操作间隔和等待时间都乘 10，再跑同一场景：
//   const cdp = await context.newCDPSession(page)
//   await cdp.send('Animation.enable')
//   await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 })
// 真跳变不是过渡走出来的，放慢后照样出现、幅度不变，算问题；放慢后消失的是过渡本身走得快，不算。
// 这只放慢 CSS 过渡、CSS 动画和 Web Animations；用 requestAnimationFrame 手写的动画不受影响，要改它自己的时长。
// 每条候选附 around（那一帧前后各几个值），方便在报告里对照原速和放慢后的结果。
// 浏览器有时两帧才更新一次某个属性，所以先去掉连续重复的值，再拿每次变化和相邻的变化比。
// stop() 的第一个参数可以改阈值：{ top: 8, left: 8, width: 6, height: 6, scale: 0.02, opacity: 0.3 }，
// scale 同时用于 scaleX 和 scaleY。
// 刚出现的元素第一次变化不算（进场动画从它自己的起点开始）。
// 缩放读的是元素自身的 CSS scale 属性乘上 transform 里的缩放；宽高是布局尺寸（offsetWidth/offsetHeight），
// 不含变换。祖先元素上的缩放读不到，只能从位置的变化间接看出。
// 位置是相对窗口的（getBoundingClientRect），录制期间不要滚动页面，否则所有元素都会报跳变。
// 只能在 Playwright 的 Chromium 里逐帧测；iOS Safari 上是否连贯，仍要在报告里列给用户确认。
// 用块作用域包住辅助函数，重复注入同一页面时不会因重名报错。
/* oxlint-disable unicorn/consistent-function-scoping */
{
  const KEYS = ['top', 'bottom', 'left', 'width', 'height', 'scaleX', 'scaleY', 'opacity']
  // computed `scale` is "none", "x", "x y" or "x y z"
  const readScale = (value) => {
    if (!value || value === 'none') return [1, 1]
    const [x, y = x] = value.split(' ').map(Number.parseFloat)
    return [x, y]
  }
  // computed `transform` is "none", "matrix(a, b, c, d, e, f)" or "matrix3d(16 values)"
  const readTransform = (value) => {
    if (!value || value === 'none') return [1, 1]
    const m = value
      .slice(value.indexOf('(') + 1, -1)
      .split(',')
      .map(Number.parseFloat)
    if (value.startsWith('matrix3d')) {
      return [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6])]
    }
    return [Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])]
  }
  const read = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const [sx, sy] = readScale(s.scale)
    const [tx, ty] = readTransform(s.transform)
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      width: el.offsetWidth,
      height: el.offsetHeight,
      scaleX: sx * tx,
      scaleY: sy * ty,
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
      if (!state) throw new Error('[douFrames] stop() 之前要先调用 start(selector)')
      state.running = false
      const { scale, ...rest } = limits
      const lim = {
        top: 8,
        bottom: 8,
        left: 8,
        width: 6,
        height: 6,
        scaleX: scale ?? 0.02,
        scaleY: scale ?? 0.02,
        opacity: 0.3,
        ...rest,
      }
      const { samples } = state
      const t0 = samples[0]?.t ?? 0
      const round = (n) => Math.round(n * 1000) / 1000
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
          const near = Math.max(Math.abs(step(i - 1)), Math.abs(step(i + 1)))
          if (Math.abs(d) > lim[key] && Math.abs(d) > 2.5 * near) {
            jumps.push({
              id,
              key,
              from: round(values[i - 1].v),
              to: round(values[i].v),
              at: Math.round(values[i].t - t0),
              around: values.slice(Math.max(0, i - 4), i + 4).map((x) => round(x.v)),
            })
          }
        }
      }
      return { frames: samples.length, jumps, maxStep, samples }
    },
  }
}
