// 在页面里测量一组控件的尺寸、居中和间距，供 dou-pr-review 使用。
// 用法（Playwright）：
//   await page.addScriptTag({ path: '.claude/skills/dou-pr-review/measure.js' })
//   const report = await page.evaluate((selector) => window.douMeasure(selector), '.dou-sheet-toolbar')
// 返回每个匹配容器里每个可见控件（按钮、菜单项、选项等）里图标、色块的尺寸、四边留白和中心偏移，
// 以及超出容差的问题。第二个参数可选：{ tolerance: 0.75, marks: 'svg, img, ...' }。
// 用块作用域包住辅助函数，重复注入同一页面时不会因重名报错。
/* oxlint-disable unicorn/consistent-function-scoping */
{
  const round = (n) => Math.round(n * 100) / 100
  const box = (el) => el.getBoundingClientRect()
  const visible = (el) => {
    const r = box(el)
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const tag = (el) => el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('')
  const name = (el) =>
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.textContent?.trim().slice(0, 20) ||
    tag(el)

  globalThis.douMeasure = (selector, options = {}) => {
    const tolerance = options.tolerance ?? 0.75
    const marks = options.marks ?? 'svg, img, [class*="swatch"], [class*="chip"], [class*="dot"]'
    return [...document.querySelectorAll(selector)].map((container) => {
      const issues = []
      const items = [
        ...container.querySelectorAll(
          'button, [role="button"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], label, a',
        ),
      ]
        .filter(visible)
        .map((control) => {
          const c = box(control)
          const inner = [...control.querySelectorAll(marks)].filter(visible).map((mark) => {
            const m = box(mark)
            const dx = m.left + m.width / 2 - (c.left + c.width / 2)
            const dy = m.top + m.height / 2 - (c.top + c.height / 2)
            return {
              mark: tag(mark),
              width: round(m.width),
              height: round(m.height),
              // 四边留白：色块、图标在框里是否四边相等
              gaps: [m.top - c.top, c.right - m.right, c.bottom - m.bottom, m.left - c.left].map(
                round,
              ),
              dy: round(dy),
              dx: round(dx),
            }
          })
          const only = inner.length === 1 && !control.textContent?.trim()
          for (const m of inner) {
            if (Math.abs(m.dy) > tolerance)
              issues.push(`${name(control)}：${m.mark} 垂直偏离 ${m.dy}px`)
            if (only && Math.abs(m.dx) > tolerance)
              issues.push(`${name(control)}：${m.mark} 水平偏离 ${m.dx}px`)
          }
          return { control: name(control), width: round(c.width), height: round(c.height), inner }
        })

      // 同一组里的控件高度、图标尺寸应该一致
      const heights = new Set(items.map((i) => i.height))
      if (heights.size > 1) issues.push(`控件高度不一致：${[...heights].join(' / ')}`)
      const iconSizes = new Set(
        items.flatMap((i) =>
          i.inner.filter((m) => m.mark.startsWith('svg')).map((m) => `${m.width}×${m.height}`),
        ),
      )
      if (iconSizes.size > 1) issues.push(`图标尺寸不一致：${[...iconSizes].join(' / ')}`)

      // 相邻控件的间距
      const spacing = []
      const rects = [...container.querySelectorAll('button, [role="button"]')]
        .filter(visible)
        .map(box)
      for (let i = 1; i < rects.length; i++) {
        if (Math.abs(rects[i].top - rects[i - 1].top) < 1)
          spacing.push(round(rects[i].left - rects[i - 1].right))
      }

      return { container: name(container), items, spacing, issues }
    })
  }
}
