import { onBeforeUnmount, onMounted } from 'vue'

/** How long scrolling has to stay still after the finger lifts to count as over, in ms. */
const SETTLE = 150

let users = 0
let touching = false
let moving = false
let timer: ReturnType<typeof setTimeout> | undefined
const waiting = new Set<() => void>()

function settle() {
  if (touching) return
  moving = false
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
  moving = true
  clearTimeout(timer)
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length) return
  touching = false
  settleLater()
}

// momentum and the bounce at an end go on firing scroll events after the finger lifts
function onScroll() {
  if (moving && !touching) settleLater()
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
  touching = moving = false
  waiting.clear()
}

export interface UseTouchScrollReturn {
  /** Whether a finger is on the screen, or the scrolling it started is still moving. */
  active(): boolean
  /**
   * Runs `callback` now, or once a touch scroll has come to rest. Passing
   * the same function again while it waits doesn't queue it twice.
   */
  whenSettled(callback: () => void): void
}

/**
 * Tells when a touch scroll, with its momentum and the bounce at an end,
 * is over. iOS drops scroll positions written while it goes on, so moves
 * that keep content in place, e.g. after adding items above the view,
 * wait for it with `whenSettled`.
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
    active: () => moving,
    whenSettled(callback) {
      if (!moving) return callback()
      own.add(callback)
      waiting.add(callback)
    },
  }
}
