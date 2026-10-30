import { onScopeDispose, readonly, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'

type Target = Element | null | undefined
type Targets = Target | Target[]

const list = (targets: Targets) =>
  (Array.isArray(targets) ? targets : [targets]).filter((el): el is Element => !!el)

const px = (value: string) => Number.parseFloat(value) || 0

export interface UseResizeObserverOptions {
  /** Which box to watch. Defaults to `content-box`. */
  box?: ResizeObserverBoxOptions
}

/**
 * Calls `callback` when any of the elements changes size, following the
 * elements when the getter returns new ones. Does nothing on the server or
 * where `ResizeObserver` is missing.
 */
export function useResizeObserver(
  target: MaybeRefOrGetter<Targets>,
  callback: ResizeObserverCallback,
  options: UseResizeObserverOptions = {},
) {
  let observer: ResizeObserver | undefined
  const disconnect = () => {
    observer?.disconnect()
    observer = undefined
  }
  const stopWatch = watch(
    () => list(toValue(target)),
    (elements) => {
      disconnect()
      if (typeof ResizeObserver === 'undefined' || !elements.length) return
      observer = new ResizeObserver(callback)
      for (const el of elements) observer.observe(el, { box: options.box })
    },
    { immediate: true, flush: 'post' },
  )
  const stop = () => {
    stopWatch()
    disconnect()
  }
  onScopeDispose(stop)
  return { stop }
}

export interface UseElementSizeOptions extends UseResizeObserverOptions {
  /** Used until the element is measured, and on the server. */
  initial?: { width: number; height: number }
}

/** The width and height of an element in px, kept up to date. */
export function useElementSize(
  target: MaybeRefOrGetter<Target>,
  options: UseElementSizeOptions = {},
): { width: Readonly<Ref<number>>; height: Readonly<Ref<number>>; stop: () => void } {
  const width = ref(options.initial?.width ?? 0)
  const height = ref(options.initial?.height ?? 0)
  const borderBox = options.box === 'border-box'

  // Measured once right away, so the first render after mounting is correct.
  watch(
    () => toValue(target),
    (el) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (borderBox || !(el instanceof HTMLElement)) {
        width.value = rect.width
        height.value = rect.height
      } else {
        const style = getComputedStyle(el)
        width.value = el.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
        height.value = el.clientHeight - px(style.paddingTop) - px(style.paddingBottom)
      }
    },
    { immediate: true, flush: 'post' },
  )

  const { stop } = useResizeObserver(
    target,
    ([entry]) => {
      if (!entry) return
      const box = borderBox ? entry.borderBoxSize?.[0] : entry.contentBoxSize?.[0]
      width.value = box ? box.inlineSize : entry.contentRect.width
      height.value = box ? box.blockSize : entry.contentRect.height
    },
    options,
  )
  return { width: readonly(width), height: readonly(height), stop }
}

export interface UseIntersectionOptions {
  /** The scrolling ancestor to test against. Defaults to the viewport. */
  root?: MaybeRefOrGetter<Element | Document | null | undefined>
  /** Grows or shrinks the root's box, as in CSS: `'200px 0px'`. */
  rootMargin?: MaybeRefOrGetter<string | undefined>
  /** The visible shares at which to update, from 0 to 1. */
  threshold?: MaybeRefOrGetter<number | number[] | undefined>
  /** Stop watching after the element first becomes visible, e.g. to load something once. */
  once?: boolean
}

/** Whether an element is visible in the viewport or a scrolling ancestor. */
export function useIntersection(
  target: MaybeRefOrGetter<Target>,
  options: UseIntersectionOptions = {},
): {
  isIntersecting: Readonly<Ref<boolean>>
  ratio: Readonly<Ref<number>>
  entry: Readonly<ShallowRef<IntersectionObserverEntry | null>>
  stop: () => void
} {
  const isIntersecting = ref(false)
  const ratio = ref(0)
  const entry = shallowRef<IntersectionObserverEntry | null>(null)
  let observer: IntersectionObserver | undefined
  let done = false

  const disconnect = () => {
    observer?.disconnect()
    observer = undefined
  }
  const stopWatch = watch(
    () =>
      [
        toValue(target),
        toValue(options.root),
        toValue(options.rootMargin),
        toValue(options.threshold),
      ] as const,
    ([el, root, rootMargin, threshold]) => {
      disconnect()
      if (done || !el || typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1]
          if (!last) return
          entry.value = last
          isIntersecting.value = last.isIntersecting
          ratio.value = last.intersectionRatio
          if (options.once && last.isIntersecting) stop()
        },
        { root: root ?? null, rootMargin, threshold },
      )
      observer.observe(el)
    },
    { immediate: true, flush: 'post' },
  )
  function stop() {
    done = true
    stopWatch()
    disconnect()
  }
  onScopeDispose(stop)
  return { isIntersecting: readonly(isIntersecting), ratio: readonly(ratio), entry, stop }
}
