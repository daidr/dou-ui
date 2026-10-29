import { nextTick } from 'vue'
import { isWindow, resolveScrollTarget, viewportOf } from '../../utils/scroll'
import type { ScrollTarget } from '../../utils/scroll'

export interface ScrollEndOptions {
  /** The element whose end is watched. */
  el: HTMLElement
  /** Where scrolling happens. Defaults to `el` when it scrolls, else its nearest scroll parent. */
  target?: ScrollTarget
  /** Load when the end is this close, in px. */
  distance: () => number
  /** Whether loading may start now. */
  active: () => boolean
  load: () => unknown
}

const scrolls = (el: HTMLElement) => /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)

/**
 * Call `load` whenever the end of `el` comes within `distance` of the
 * bottom of its scroll area, once at a time. After a load the end is
 * checked again, so a short first page keeps loading until the area is
 * full; a load that adds nothing waits for the next scroll instead.
 */
export function watchScrollEnd(options: ScrollEndOptions) {
  const { el } = options
  const inside = !options.target && scrolls(el)
  const target = inside ? el : resolveScrollTarget(options.target, el)

  /** How far the end of the content is below the bottom of the visible area. */
  function remaining() {
    if (inside) return el.scrollHeight - el.scrollTop - el.clientHeight
    if (!el.getClientRects().length) return Infinity
    return el.getBoundingClientRect().bottom - viewportOf(target).bottom
  }
  const height = () => el.scrollHeight

  let busy = false
  let stopped = false
  async function check() {
    if (busy || stopped || !options.active() || remaining() > options.distance()) return
    busy = true
    const before = height()
    try {
      await options.load()
    } finally {
      busy = false
    }
    await nextTick()
    if (height() !== before) void check()
  }
  const onScroll = () => void check()

  target.addEventListener('scroll', onScroll, { passive: true })
  if (!isWindow(target)) window.addEventListener('resize', onScroll, { passive: true })
  // A size change can bring the end into reach; the first report of each
  // element is only its starting size.
  const seen = new WeakSet<Element>()
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) => {
          const changed = entries.some((entry) => seen.has(entry.target))
          for (const entry of entries) seen.add(entry.target)
          if (changed) onScroll()
        })
  observer?.observe(el)
  if (!inside && !isWindow(target)) observer?.observe(target)

  return {
    check,
    stop() {
      stopped = true
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      observer?.disconnect()
    },
  }
}
