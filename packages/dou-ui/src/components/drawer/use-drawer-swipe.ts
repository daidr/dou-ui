import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { DrawerPlacement, DrawerSnapPoint } from './drawer'

interface SwipeOptions {
  panel: Readonly<Ref<HTMLElement | null>>
  enabled: () => boolean
  placement: () => DrawerPlacement
  /** Snap points as given: a number is px, `'40%'` a share of the viewport. */
  snapPoints: () => DrawerSnapPoint[] | undefined
  snap: Ref<DrawerSnapPoint | undefined>
  /** Ask to close; resolves to whether the drawer is closing. */
  requestClose: () => Promise<boolean>
}

// Below this distance a move is not yet a drag, so taps and clicks still work.
const SLOP = 6
// How far ahead a release is projected from its speed, in ms.
const PROJECT = 160

const swallow = (click: Event) => {
  click.stopPropagation()
  click.preventDefault()
}

// Past the largest snap point the panel follows the pointer less and less.
const rubber = (over: number) => Math.round(Math.sqrt(over) * 4)

// Elements that keep the pointer to themselves.
const OWN_POINTER = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

/** Dragging a drawer towards its edge to close it, and between snap points. */
export function useDrawerSwipe(options: SwipeOptions) {
  const horizontal = computed(() => {
    const placement = options.placement()
    return placement === 'left' || placement === 'right'
  })
  // +1 when closing moves the pointer to larger coordinates (right, bottom).
  const sign = computed(() => {
    const placement = options.placement()
    return placement === 'right' || placement === 'bottom' ? 1 : -1
  })

  const viewport = ref({ width: 0, height: 0 })
  const measure = () => (viewport.value = { width: window.innerWidth, height: window.innerHeight })
  onMounted(() => {
    measure()
    window.addEventListener('resize', measure)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', measure))

  const resolve = (point: DrawerSnapPoint) => {
    if (typeof point === 'number') return Math.round(point)
    const length = horizontal.value ? viewport.value.width : viewport.value.height
    const value = Number.parseFloat(point)
    return Math.round(point.trim().endsWith('%') ? (value / 100) * length : value)
  }
  /** Snap points, smallest first, with their size in px. */
  const snaps = computed(() =>
    (options.snapPoints() ?? [])
      .map((point) => ({ point, size: resolve(point) }))
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
      .sort((a, b) => a.size - b.size),
  )
  const hasSnaps = computed(() => snaps.value.length > 0)
  /** The snap point the drawer rests on. */
  const current = computed(() => {
    const list = snaps.value
    return list.find((s) => s.point === options.snap.value) ?? list[0]
  })

  /** The size while dragging between snap points, in px. */
  const dragSize = ref<number | null>(null)
  /** How far the panel is pushed towards its edge, in px. */
  const offset = ref(0)
  const dragging = ref(false)
  /** Animating to where a drag was let go. */
  const settling = ref(false)

  const size = computed(() =>
    hasSnaps.value ? (dragSize.value ?? current.value?.size ?? null) : null,
  )
  const transform = computed(() => {
    if (!offset.value) return undefined
    const value = sign.value * offset.value
    return horizontal.value ? `translateX(${value}px)` : `translateY(${value}px)`
  })

  /** The scrollable element between the target and the panel along the drag axis. */
  function scroller(target: Element | null) {
    const panel = options.panel.value
    for (let el = target; el && el !== panel; el = el.parentElement) {
      const style = getComputedStyle(el)
      const overflow = horizontal.value ? style.overflowX : style.overflowY
      if (overflow !== 'auto' && overflow !== 'scroll') continue
      const room = horizontal.value
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight
      if (room > 0) return el
    }
    return null
  }

  /** Whether a scroller would move for this drag, `towardsEdge` meaning a closing drag. */
  function scrollerTakes(el: Element, towardsEdge: boolean) {
    const position = horizontal.value ? el.scrollLeft : el.scrollTop
    const max = horizontal.value
      ? el.scrollWidth - el.clientWidth
      : el.scrollHeight - el.clientHeight
    // A closing drag on a bottom drawer moves the finger down, which scrolls back to the start.
    const backwards = towardsEdge === sign.value > 0
    return backwards ? position > 0 : position < max - 1
  }

  let stop: (() => void) | undefined

  // Touch scrolling starts on the first `touchmove`, so a drag cancels it there.
  const touchmove = (e: TouchEvent) => {
    if (dragging.value && e.cancelable) e.preventDefault()
  }

  function onPointerdown(event: PointerEvent) {
    if (!options.enabled() || stop || settling.value) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as Element
    if (target.closest(OWN_POINTER) || target.closest('.dou-drawer__resizer')) return
    if (target.closest('[data-dou-no-swipe]')) return
    // A mouse drags from the handle or the header only, so text can still be selected.
    if (
      event.pointerType === 'mouse' &&
      !target.closest('.dou-drawer__handle, .dou-drawer__header')
    )
      return

    const panelSize = () => {
      const rect = options.panel.value!.getBoundingClientRect()
      return horizontal.value ? rect.width : rect.height
    }
    const start = horizontal.value ? event.clientX : event.clientY
    const startAcross = horizontal.value ? event.clientY : event.clientX
    const startSize = size.value ?? panelSize()
    const startOffset = offset.value
    const scrollEl = scroller(target)
    let samples: { at: number; d: number }[] = []

    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return
      // The distance moved towards the edge.
      const d = sign.value * ((horizontal.value ? e.clientX : e.clientY) - start)
      if (!dragging.value) {
        const cross = Math.abs((horizontal.value ? e.clientY : e.clientX) - startAcross)
        if (Math.abs(d) < SLOP && cross < SLOP) return
        // A move along the other axis, or one the content scrolls for, is not ours.
        if (cross > Math.abs(d)) return end()
        if (d < 0) {
          // Pulling away from the edge grows the drawer, or takes back a push.
          const largest = snaps.value[snaps.value.length - 1]
          if (!startOffset && !(largest && startSize < largest.size - 1)) return end()
        } else if (scrollEl && scrollerTakes(scrollEl, true)) return end()
        dragging.value = true
        if (e.pointerType === 'mouse') options.panel.value?.setPointerCapture?.(e.pointerId)
      }
      e.preventDefault()
      samples.push({ at: e.timeStamp, d })
      samples = samples.filter((s) => e.timeStamp - s.at < 100)
      if (hasSnaps.value) {
        const min = snaps.value[0]!.size
        const max = snaps.value[snaps.value.length - 1]!.size
        const next = startSize - startOffset - d
        if (next > max) {
          dragSize.value = max + rubber(next - max)
          offset.value = 0
        } else if (next < min) {
          dragSize.value = min
          offset.value = min - next
        } else {
          dragSize.value = next
          offset.value = 0
        }
      } else {
        const next = startOffset + d
        offset.value = next >= 0 ? next : -rubber(-next)
      }
    }

    const up = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return
      const wasDragging = dragging.value
      end()
      if (!wasDragging) return
      // A drag is not a click on whatever it started on.
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)

      const first = samples[0]
      const last = samples[samples.length - 1]
      const velocity =
        first && last && last.at > first.at ? (last.d - first.d) / (last.at - first.at) : 0
      void release(velocity, panelSize())
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      options.panel.value?.removeEventListener('touchmove', touchmove)
      dragging.value = false
      stop = undefined
    }
    stop = end
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    options.panel.value?.addEventListener('touchmove', touchmove, { passive: false })
  }

  async function release(velocity: number, panelSize: number) {
    if (hasSnaps.value) {
      const list = snaps.value
      const shown = (dragSize.value ?? list[0]!.size) - offset.value
      const projected = shown - velocity * PROJECT
      if (projected < list[0]!.size / 2) {
        if (await closeFromSwipe(panelSize)) return
      }
      let target = list[0]!
      for (const s of list)
        if (Math.abs(s.size - projected) < Math.abs(target.size - projected)) target = s
      settle(() => {
        options.snap.value = target.point
        dragSize.value = null
        offset.value = 0
      })
      return
    }
    const projected = offset.value + velocity * PROJECT
    if (projected > panelSize * 0.4 || (velocity > 0.5 && offset.value > SLOP)) {
      if (await closeFromSwipe(panelSize)) return
    }
    settle(() => (offset.value = 0))
  }

  async function closeFromSwipe(panelSize: number) {
    if (!(await options.requestClose())) return false
    // The leaving drawer goes on from where it was let go; `onClosed` puts it back.
    settling.value = true
    offset.value = panelSize + 16
    return true
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined
  function settle(apply: () => void) {
    settling.value = true
    apply()
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => (settling.value = false), 400)
  }

  /** Back to rest once the drawer has closed. */
  function reset() {
    stop?.()
    clearTimeout(settleTimer)
    settling.value = false
    dragSize.value = null
    offset.value = 0
  }
  onBeforeUnmount(reset)

  /** Move one snap point bigger (`1`) or smaller (`-1`); cycles when `wrap`. */
  function step(direction: 1 | -1, wrap = false) {
    const list = snaps.value
    if (!list.length) return
    let index = list.indexOf(current.value!) + direction
    if (wrap) index = (index + list.length) % list.length
    index = Math.min(Math.max(index, 0), list.length - 1)
    settle(() => (options.snap.value = list[index]!.point))
  }

  return {
    hasSnaps,
    snaps,
    current,
    size,
    transform,
    dragging,
    settling,
    onPointerdown,
    step,
    reset,
  }
}
