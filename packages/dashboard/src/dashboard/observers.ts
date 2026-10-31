import type { InjectionKey } from 'vue'

type Callback = (entry: ResizeObserverEntry | IntersectionObserverEntry) => void

/**
 * One `ResizeObserver` and one `IntersectionObserver` for all the widgets of
 * a dashboard, instead of one per widget: with hundreds of widgets, creating
 * the observers is a large part of mounting them.
 */
export interface DashboardObservers {
  /** Calls `callback` with the element's new size; returns a function that stops. */
  size: (el: Element, callback: (entry: ResizeObserverEntry) => void) => () => void
  /** Calls `callback` once the element comes within two screens of view; returns a function that stops. */
  near: (el: Element, callback: () => void) => () => void
  dispose: () => void
}

export const observersKey: InjectionKey<DashboardObservers> = Symbol('dou-dashboard-observers')

export function createObservers(): DashboardObservers {
  const sized = new Map<Element, Callback>()
  const seen = new Map<Element, Callback>()
  let resize: ResizeObserver | undefined
  let intersect: IntersectionObserver | undefined
  const run =
    (map: Map<Element, Callback>) =>
    (entries: (ResizeObserverEntry | IntersectionObserverEntry)[]) => {
      for (const entry of entries) {
        if ('isIntersecting' in entry && !entry.isIntersecting) continue
        map.get(entry.target)?.(entry)
      }
    }
  return {
    size(el, callback) {
      if (typeof ResizeObserver === 'undefined') return () => {}
      resize ??= new ResizeObserver(run(sized))
      sized.set(el, callback as Callback)
      resize.observe(el)
      return () => {
        sized.delete(el)
        resize?.unobserve(el)
      }
    },
    near(el, callback) {
      if (typeof IntersectionObserver === 'undefined') {
        callback()
        return () => {}
      }
      intersect ??= new IntersectionObserver(run(seen), { rootMargin: '200% 0px' })
      seen.set(el, callback)
      intersect.observe(el)
      return () => {
        seen.delete(el)
        intersect?.unobserve(el)
      }
    },
    dispose() {
      resize?.disconnect()
      intersect?.disconnect()
      sized.clear()
      seen.clear()
    },
  }
}
