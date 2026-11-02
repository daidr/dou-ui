/** Where a component listens for scrolling: an element, a selector, or the window. */
export type ScrollTarget = string | HTMLElement | Window | (() => HTMLElement | Window | null)

const scrolls = (el: Element) => /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)

/** The nearest ancestor that scrolls, or the window. */
export function getScrollParent(el: Element | null | undefined): HTMLElement | Window {
  let node = el?.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    if (scrolls(node)) return node
    node = node.parentElement
  }
  return window
}

/** Resolve a `target` prop, falling back to the nearest scroll container of `el`. */
export function resolveScrollTarget(
  target: ScrollTarget | undefined,
  el: Element | null | undefined,
): HTMLElement | Window {
  if (typeof target === 'function') return target() ?? window
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target) ?? window
  return target ?? getScrollParent(el)
}

export const isWindow = (target: HTMLElement | Window): target is Window => target === window

export const scrollTopOf = (target: HTMLElement | Window) =>
  isWindow(target) ? window.scrollY : target.scrollTop

/** The visible top and bottom of a scroll container, in viewport coordinates. */
export function viewportOf(target: HTMLElement | Window) {
  if (isWindow(target)) return { top: 0, bottom: window.innerHeight }
  const rect = target.getBoundingClientRect()
  return { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, window.innerHeight) }
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(0, max))

/**
 * Where `el` is scrolled to, kept inside its scroll range. While content
 * bounces back at an end, iOS and macOS report positions before the start
 * (negative) or past the end; anything worked out from the position should
 * read it from here instead.
 */
export function scrollPositionOf(el: HTMLElement): { top: number; left: number } {
  return {
    top: clamp(el.scrollTop, el.scrollHeight - el.clientHeight),
    left: clamp(el.scrollLeft, el.scrollWidth - el.clientWidth),
  }
}

/** Which way elements linked by `createScrollLink` follow each other. */
export type ScrollLinkAxis = 'x' | 'y' | 'both'

export interface ScrollLink {
  /**
   * Scroll `to` to where `from` is; call it from the scroll handler of
   * `from`. The scroll event `to` then fires reports this write, and
   * following it back is skipped, so a scroller still moving under a
   * finger or momentum is never pulled back to where it was a frame ago.
   */
  follow(from: HTMLElement, to: HTMLElement): void
}

/** Keeps scrollers in step, e.g. a fixed column and the grid beside it. */
export function createScrollLink(axis: ScrollLinkAxis = 'both'): ScrollLink {
  const written = new WeakMap<HTMLElement, { top: number; left: number }>()
  const y = axis !== 'x'
  const x = axis !== 'y'
  return {
    follow(from, to) {
      const echo = written.get(from)
      if (echo) {
        written.delete(from)
        if (
          (!y || Math.abs(from.scrollTop - echo.top) < 1) &&
          (!x || Math.abs(from.scrollLeft - echo.left) < 1)
        )
          return
      }
      const { top, left } = scrollPositionOf(from)
      let moved = false
      if (y && Math.abs(to.scrollTop - top) >= 1) {
        to.scrollTop = top
        moved = true
      }
      if (x && Math.abs(to.scrollLeft - left) >= 1) {
        to.scrollLeft = left
        moved = true
      }
      if (moved) written.set(to, { top: to.scrollTop, left: to.scrollLeft })
    },
  }
}
