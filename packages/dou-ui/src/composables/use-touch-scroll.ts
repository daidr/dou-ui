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
  const callbacks = [...waiting]
  waiting.clear()
  for (const callback of callbacks) callback()
}

function settleLater() {
  clearTimeout(timer)
  timer = setTimeout(settle, SETTLE)
}

function onTouchStart() {
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
// a step measured in this touch, it waits for two events and measures one.
// Anything unclear counts as held: taking a held move for a dropped one
// would move the content twice.
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

function makeLost() {
  for (const [el, delta] of lost) if (el.isConnected) el.scrollTop += delta
  lost.clear()
}

function drop(el: HTMLElement, shift: Shift) {
  lost.set(el, (lost.get(el) ?? 0) + shift.delta)
  if (moving.value) waiting.add(makeLost)
  else makeLost()
}

/** Whether `top`, a step after the move, is clearly where the move was dropped. */
function wasDropped(shift: Shift, top: number, step: number) {
  const near = Math.max(3, Math.abs(step) / 2)
  const held = Math.abs(top - (shift.to + step))
  const dropped = Math.abs(top - (shift.from + step))
  return dropped <= near && held > near && dropped < held
}

/**
 * When the scroll is over, a move still unchecked counts as dropped only
 * when the scroller rests right where it was before it. Steps start afresh
 * with the next touch.
 */
function resolveShifts() {
  for (const [el, shift] of shifts) {
    const top = el.scrollTop
    if (Math.abs(top - shift.from) <= 1 && Math.abs(top - shift.to) > 1) drop(el, shift)
  }
  shifts.clear()
  steps = new WeakMap()
}

/** Whether the scroll event is the one the move itself fired. */
function checkShift(el: HTMLElement, top: number) {
  const shift = shifts.get(el)
  if (!shift) return false
  if (Math.abs(top - shift.to) < 0.5) return true
  if (shift.step === undefined) {
    if (shift.first === undefined) {
      shift.first = top
      return false
    }
    shifts.delete(el)
    if (wasDropped(shift, shift.first, top - shift.first)) drop(el, shift)
    return false
  }
  shifts.delete(el)
  if (wasDropped(shift, top, shift.step)) drop(el, shift)
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

function shiftScroll(el: HTMLElement, delta: number) {
  if (Math.abs(delta) < 0.5) return
  const from = el.scrollTop
  el.scrollTop = from + delta
  if (!moving.value) return
  const last = shifts.get(el)
  const step = steps.get(el)?.step
  shifts.set(el, {
    from: last ? last.from : from,
    to: from + delta,
    delta: (last?.delta ?? 0) + delta,
    step: last ? last.step : step,
  })
  // the next step is measured from where the move should have taken it
  steps.set(el, { top: from + delta, step })
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
  lost.clear()
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
  }
}
