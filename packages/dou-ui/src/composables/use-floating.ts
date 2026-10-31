import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { CSSProperties, MaybeRefOrGetter, Ref } from 'vue'

export type Side = 'top' | 'right' | 'bottom' | 'left'
export type Placement = Side | `${Side}-start` | `${Side}-end`

interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionOptions {
  /** The gap between the reference and the floating element. */
  offset: number
  /** The least distance kept from the edges of the viewport. */
  padding: number
  /** Move to the opposite side when the preferred one has no room. */
  flip: boolean
  viewport: { width: number; height: number }
}

export interface Position {
  x: number
  y: number
  placement: Placement
  /** The room left on the chosen side, for capping the height of long content. */
  available: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)))

const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/**
 * Place a box of `size` next to `reference`, all in viewport coordinates.
 *
 * The box sits on the preferred side, flips to the opposite one when it
 * would overflow there and the opposite has more room, then slides along
 * the other axis to stay inside the viewport. A box beside the reference
 * that fits on neither side also slides sideways, over the reference.
 */
export function computePosition(
  reference: Box,
  size: { width: number; height: number },
  placement: Placement,
  { offset, padding, flip, viewport }: PositionOptions,
): Position {
  const [preferred, align] = placement.split('-') as [Side, 'start' | 'end' | undefined]
  const { width, height } = size

  const place = (side: Side) => {
    const vertical = side === 'top' || side === 'bottom'
    const cross = vertical
      ? align === 'start'
        ? reference.x
        : align === 'end'
          ? reference.x + reference.width - width
          : reference.x + (reference.width - width) / 2
      : align === 'start'
        ? reference.y
        : align === 'end'
          ? reference.y + reference.height - height
          : reference.y + (reference.height - height) / 2
    if (side === 'top') return { x: cross, y: reference.y - height - offset }
    if (side === 'bottom') return { x: cross, y: reference.y + reference.height + offset }
    if (side === 'left') return { x: reference.x - width - offset, y: cross }
    return { x: reference.x + reference.width + offset, y: cross }
  }
  const room = (side: Side) => {
    if (side === 'top') return reference.y - offset - padding
    if (side === 'bottom')
      return viewport.height - reference.y - reference.height - offset - padding
    if (side === 'left') return reference.x - offset - padding
    return viewport.width - reference.x - reference.width - offset - padding
  }
  const needed = (side: Side) => (side === 'top' || side === 'bottom' ? height : width)

  let side = preferred
  if (flip && room(side) < needed(side) && room(opposite[side]) > room(side)) side = opposite[side]

  let { x, y } = place(side)
  if (side === 'top' || side === 'bottom') x = clamp(x, padding, viewport.width - padding - width)
  else {
    y = clamp(y, padding, viewport.height - padding - height)
    // too wide for either side (a submenu on a phone): it covers part of the
    // reference instead of running off the screen
    x = clamp(x, padding, Math.max(padding, viewport.width - padding - width))
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    placement: (align ? `${side}-${align}` : side) as Placement,
    available: Math.max(0, Math.floor(room(side))),
  }
}

/** Anything with a box to sit next to, e.g. a point where the pointer was pressed. */
export interface VirtualElement {
  getBoundingClientRect: () => DOMRect
}

export interface UseFloatingOptions {
  open: MaybeRefOrGetter<boolean>
  placement: MaybeRefOrGetter<Placement>
  offset?: MaybeRefOrGetter<number>
  /** Make the floating element at least as wide as the reference. */
  sameWidth?: MaybeRefOrGetter<boolean>
}

/**
 * Keep `floating` next to `reference` while open: positioned `fixed`,
 * recomputed on scroll, resize and when either element changes size.
 */
export function useFloating(
  reference: () => Element | VirtualElement | null | undefined,
  floating: Ref<HTMLElement | null>,
  options: UseFloatingOptions,
) {
  const position = ref<Position | null>(null)

  function update() {
    const anchor = reference()
    const target = floating.value
    if (!anchor || !target) return
    const box = anchor.getBoundingClientRect()
    if (toValue(options.sameWidth)) target.style.minWidth = `${box.width}px`
    position.value = computePosition(
      box,
      { width: target.offsetWidth, height: target.offsetHeight },
      toValue(options.placement),
      {
        offset: toValue(options.offset) ?? 8,
        padding: 8,
        flip: true,
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
      },
    )
  }

  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  let observer: ResizeObserver | undefined
  function start() {
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule)
      const anchor = reference()
      if (anchor instanceof Element) observer.observe(anchor)
      if (floating.value) observer.observe(floating.value)
    }
  }
  function stop() {
    window.removeEventListener('scroll', schedule, { capture: true })
    window.removeEventListener('resize', schedule)
    observer?.disconnect()
    observer = undefined
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  watch(
    [() => toValue(options.open), floating],
    ([open, target]) => {
      stop()
      if (!open || !target || typeof window === 'undefined') return
      update()
      start()
    },
    { flush: 'post' },
  )
  watch([() => toValue(options.placement), () => toValue(options.offset)], () => update(), {
    flush: 'post',
  })
  onScopeDispose(stop)

  const style = computed<CSSProperties>(() => {
    const { x = 0, y = 0, available } = position.value ?? {}
    return {
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      '--dou-floating-available': available === undefined ? undefined : `${available}px`,
    } as CSSProperties
  })
  const placement = computed(() => position.value?.placement ?? toValue(options.placement))

  return { style, placement, update }
}
