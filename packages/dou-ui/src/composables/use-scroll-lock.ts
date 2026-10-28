import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

let locks = 0
let restore: (() => void) | undefined

function lock() {
  if (locks++ > 0) return
  const { body, documentElement } = document
  const { overflow, paddingRight } = body.style
  // Hiding the scrollbar widens the page; pad it back so nothing shifts.
  const scrollbar = window.innerWidth - documentElement.clientWidth
  if (scrollbar > 0) {
    const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0
    body.style.paddingRight = `${padding + scrollbar}px`
  }
  body.style.overflow = 'hidden'
  restore = () => {
    body.style.overflow = overflow
    body.style.paddingRight = paddingRight
  }
}

function unlock() {
  if (locks === 0 || --locks > 0) return
  restore?.()
  restore = undefined
}

/** Stop the page from scrolling while `active`. Nested locks are counted. */
export function useScrollLock(active: MaybeRefOrGetter<boolean>) {
  let locked = false
  const set = (on: boolean) => {
    if (on === locked || typeof document === 'undefined') return
    locked = on
    if (on) lock()
    else unlock()
  }
  watch(() => toValue(active), set, { immediate: true })
  onScopeDispose(() => set(false))
}
