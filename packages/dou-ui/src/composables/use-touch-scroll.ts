import { onBeforeUnmount, onMounted, readonly, shallowRef } from 'vue'
import type { Ref } from 'vue'

/** How long scrolling has to stay still after the finger lifts to count as over, in ms. */
const SETTLE = 150

let users = 0
let touching = false
const moving = shallowRef(false)
const active = readonly(moving)
let timer: ReturnType<typeof setTimeout> | undefined
const waiting = new Set<() => void>()

function settle() {
  if (touching) return
  moving.value = false
  resolveShifts()
  // Apply dropped scroll shifts before settled listeners run, so handlers like
  // top-reached checks observe the restored scroll position rather than 0.
  makeLost()
  const callbacks = [...waiting]
  waiting.clear()
  for (const callback of callbacks) callback()
}

function settleLater() {
  clearTimeout(timer)
  timer = setTimeout(settle, SETTLE)
}

function onTouchStart() {
  if (!moving.value) steps = new WeakMap()
  touching = true
  moving.value = true
  clearTimeout(timer)
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length) return
  touching = false
  settleLater()
}

// A move written by `shiftScroll` during a touch scroll is checked against
// the scroll events after it: going on at the same step from where the move
// took it, the move held; from where it was before, iOS dropped it. Without
// a step measured in this touch, it waits for two events and measures one,
// unless the position is already unmistakably back near `from` while `to` is
// far away. Anything unclear counts as held: taking a held move for a dropped
// one would move the content twice.
interface Shift {
  /** Where it was before the first move, and where the moves took it. */
  from: number
  to: number
  delta: number
  /** How far one scroll event moves it, when known. */
  step?: number
  /** The first event after the move, while the step is being measured. */
  first?: number
}
/** Each scroller's last position, and its step once two events of this touch tell it. */
let steps = new WeakMap<Element, { top: number; step?: number }>()
const shifts = new Map<HTMLElement, Shift>()
/** Moves iOS dropped, made once the touch scroll is over. */
const lost = new Map<HTMLElement, number>()
const lostVersion = shallowRef(0)

function addLost(el: HTMLElement, delta: number) {
  if (Math.abs(delta) < 0.5) return
  lost.set(el, (lost.get(el) ?? 0) + delta)
  lostVersion.value++
}

function makeLost() {
  if (!lost.size) return
  for (const [el, delta] of lost) {
    if (el.isConnected) el.scrollTop = Math.max(0, Math.max(0, el.scrollTop) + delta)
  }
  lost.clear()
  lostVersion.value++
}

function pendingShift(el: HTMLElement | null | undefined) {
  void lostVersion.value
  return el ? (lost.get(el) ?? 0) : 0
}

function clearShift(el: HTMLElement | null | undefined) {
  if (!el) return
  shifts.delete(el)
  if (lost.delete(el)) lostVersion.value++
}

/**
 * Even before a step is measured, a position still at/past the top or right
 * near `from` while `to` is far away cannot be a single-frame scroll from `to`.
 */
function clearlyDroppedWithoutStep(shift: Shift, top: number) {
  const fromDist = Math.abs(top - shift.from)
  const toDist = Math.abs(top - shift.to)
  if (shift.from <= 0 && top <= 0 && shift.to > 120) return true
  return toDist > 200 && fromDist <= 80 && fromDist * 4 < toDist
}

/** Whether `top`, a step after the move, is clearly where the move was dropped. */
function wasDropped(shift: Shift, top: number, step: number) {
  const near = Math.max(3, Math.abs(step) / 2)
  const errHeld = Math.abs(top - (shift.to + step))
  const errDropped = Math.abs(top - (shift.from + step))
  if (errDropped <= near && errHeld > near && errDropped < errHeld) return true

  // Deceleration, top boundary clamping, rubber-band bounce reversal, or a
  // finger changing speed can diverge from constant `step` while still being
  // unmistakably near `from` and impossibly far from `to`.
  const stepDropped = top - shift.from
  const stepHeld = top - shift.to
  const absStep = Math.abs(step)
  const absDropped = Math.abs(stepDropped)
  const absHeld = Math.abs(stepHeld)
  const far = Math.max(24, absStep * 2)
  if (errHeld <= far || absHeld <= far) return false
  if (errDropped * 3 >= errHeld || absDropped * 3 >= absHeld) return false

  const sameDirection = step === 0 || stepDropped * step >= 0
  const decelerating = step !== 0 && sameDirection && absDropped <= absStep
  const bouncing =
    (shift.from <= 0 && top <= 0) || (shift.from < 0 && top >= 0 && top <= Math.abs(shift.from))
  const dragLimit = sameDirection ? Math.max(80, absStep * 2) : Math.max(24, absStep)
  const variableDrag = absDropped <= dragLimit && errDropped <= dragLimit + absStep
  return decelerating || bouncing || variableDrag
}

function isDroppedAt(shift: Shift, top: number, settled: boolean) {
  const toDist = Math.abs(top - shift.to)
  if (toDist <= 1) return false
  const fromDist = Math.abs(top - shift.from)
  const restDist = Math.abs(top - Math.max(0, shift.from))
  const nearFrom = Math.min(fromDist, restDist)
  if (settled && nearFrom <= 1) return true
  if (toDist <= 24) return false
  return (shift.from <= 0 && top <= 1) || (nearFrom * 3 < toDist && nearFrom <= 80)
}

/**
 * When the scroll is over, a move still unchecked counts as dropped when the
 * scroller rests where it was before (including 0 after a negative top bounce)
 * or clearly near `from` and far from `to`. Steps start afresh next touch.
 */
function resolveShifts() {
  for (const [el, shift] of shifts) {
    if (isDroppedAt(shift, el.scrollTop, true)) addLost(el, shift.delta)
  }
  shifts.clear()
  steps = new WeakMap()
}

/** Whether the scroll event is the one the move itself fired. */
function checkShift(el: HTMLElement, top: number) {
  const shift = shifts.get(el)
  if (!shift) return false
  if (shift.first === undefined && Math.abs(top - shift.to) < 0.5) return true
  if (shift.step === undefined) {
    if (shift.first === undefined) {
      if (clearlyDroppedWithoutStep(shift, top)) {
        shifts.delete(el)
        addLost(el, shift.delta)
        if (!moving.value) makeLost()
        return false
      }
      shift.first = top
      return false
    }
    shifts.delete(el)
    if (wasDropped(shift, shift.first, top - shift.first)) {
      addLost(el, shift.delta)
      if (!moving.value) makeLost()
    }
    return false
  }
  shifts.delete(el)
  if (wasDropped(shift, top, shift.step)) {
    addLost(el, shift.delta)
    if (!moving.value) makeLost()
  }
  return false
}

// momentum and the bounce at an end go on firing scroll events after the finger lifts
function onScroll(event: Event) {
  const el = event.target
  if (el instanceof HTMLElement && !checkShift(el, el.scrollTop)) {
    const top = el.scrollTop
    const last = steps.get(el)
    steps.set(el, { top, step: last ? top - last.top : undefined })
  }
  if (moving.value && !touching) settleLater()
}

function foldLost(el: HTMLElement, from: number, delta: number, maxTop: number) {
  const existing = lost.get(el) ?? 0
  const logicalBase = Math.max(0, from) + existing
  const logicalTarget = Math.min(Math.max(0, logicalBase + delta), maxTop)
  const nextLost = existing + (logicalTarget - logicalBase)
  if (Math.abs(nextLost) < 0.5) lost.delete(el)
  else lost.set(el, nextLost)
  lostVersion.value++
}

function shiftScroll(el: HTMLElement, delta: number) {
  if (Math.abs(delta) < 0.5) return
  const from = el.scrollTop
  const maxTop = el.clientHeight > 0 ? Math.max(0, el.scrollHeight - el.clientHeight) : Infinity

  // Once a shift for `el` is already known to be dropped during this touch
  // scroll, fold follow-up shifts (including negative ResizeObserver
  // corrections when items measure shorter than estimated) directly into the
  // pending offset relative to the logical scroll position.
  if (moving.value && lost.has(el)) {
    foldLost(el, from, delta, maxTop)
    return
  }

  const last = moving.value ? shifts.get(el) : undefined
  const mergeLast = last !== undefined && last.first === undefined
  let shiftFrom = from
  let shiftStep = steps.get(el)?.step

  if (last) {
    if (mergeLast) {
      shiftFrom = last.from
      shiftStep = last.step
    } else {
      // One scroll event already occurred after `last` without a known step;
      // resolve `last` before starting a fresh shift. If `last` was dropped,
      // record it and fold the follow-up `delta` into `lost` right away.
      shifts.delete(el)
      if (isDroppedAt(last, last.first!, false)) {
        addLost(el, last.delta)
        if (lost.has(el)) {
          foldLost(el, from, delta, maxTop)
          return
        }
      }
    }
  }

  const base = mergeLast ? last.to : Math.max(0, from)
  const target = Math.max(0, base + delta)
  const expected = Math.min(target, maxTop)
  const appliedDelta = expected - base
  if (Math.abs(appliedDelta) < 0.5 && !mergeLast) return

  const totalDelta = mergeLast ? last.delta + appliedDelta : appliedDelta

  el.scrollTop = expected
  if (!moving.value) return

  const after = el.scrollTop
  // Synchronous drop (or bounce snap) by iOS: `scrollTop` did not reach `expected`.
  if (Math.abs(after - expected) >= 1) {
    if (mergeLast && Math.abs(after - last.to) < 1) {
      // Previous shift still holds; only the new delta was dropped.
      addLost(el, appliedDelta)
      return
    }
    shifts.delete(el)
    addLost(el, expected - Math.max(0, after))
    return
  }

  if (Math.abs(totalDelta) < 0.5) {
    shifts.delete(el)
    return
  }

  shifts.set(el, {
    from: shiftFrom,
    to: after,
    delta: totalDelta,
    step: shiftStep,
  })
  // the next step is measured from where the move should have taken it
  steps.set(el, { top: after, step: shiftStep })
}

const listen = { capture: true, passive: true } as const

function install() {
  document.addEventListener('touchstart', onTouchStart, listen)
  document.addEventListener('touchend', onTouchEnd, listen)
  document.addEventListener('touchcancel', onTouchEnd, listen)
  document.addEventListener('scroll', onScroll, listen)
}

function uninstall() {
  document.removeEventListener('touchstart', onTouchStart, listen)
  document.removeEventListener('touchend', onTouchEnd, listen)
  document.removeEventListener('touchcancel', onTouchEnd, listen)
  document.removeEventListener('scroll', onScroll, listen)
  clearTimeout(timer)
  touching = false
  moving.value = false
  waiting.clear()
  shifts.clear()
  if (lost.size) {
    lost.clear()
    lostVersion.value++
  }
  steps = new WeakMap()
}

export interface UseTouchScrollReturn {
  /** Whether a finger is on the screen, or the scrolling it started is still moving. */
  active: Readonly<Ref<boolean>>
  /**
   * Runs `callback` now, or once a touch scroll has come to rest. Passing
   * the same function again while it waits doesn't queue it twice.
   */
  whenSettled(callback: () => void): void
  /**
   * Moves the vertical scroll position of `el` by `delta` px, e.g. to keep
   * what is in view in place after items above it change. When iOS drops
   * the move during a touch scroll, it is made again once the scroll is over.
   */
  shiftScroll(el: HTMLElement, delta: number): void
  /**
   * Total vertical shift in px that iOS dropped for `el` and will apply once
   * the touch scroll settles. Reactive so views can keep their logical scroll
   * position and anchor in sync until then.
   */
  pendingShift(el: HTMLElement | null | undefined): number
  /** Discards any pending or dropped shift tracked for `el`, e.g. before a programmatic jump. */
  clearShift(el: HTMLElement | null | undefined): void
}

/**
 * Tells when a touch scroll, with its momentum and the bounce at an end,
 * is over. iOS drops scroll positions written while it goes on: moves that
 * keep content in place go through `shiftScroll`, which makes a dropped
 * move again afterwards, and other work can wait with `whenSettled`.
 */
export function useTouchScroll(): UseTouchScrollReturn {
  const own = new Set<() => void>()
  let mounted = false
  onMounted(() => {
    mounted = true
    if (users++ === 0) install()
  })
  onBeforeUnmount(() => {
    if (!mounted) return
    mounted = false
    for (const callback of own) waiting.delete(callback)
    own.clear()
    if (--users === 0) uninstall()
  })
  return {
    active,
    whenSettled(callback) {
      if (!moving.value) return callback()
      own.add(callback)
      waiting.add(callback)
    },
    shiftScroll,
    pendingShift,
    clearShift,
  }
}
