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
