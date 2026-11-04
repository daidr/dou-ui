/**
 * Whether a pointer of this type can hover. Fingers and pens touch down
 * where they act, and the enter and leave they send come with the press.
 */
export const hasHover = (pointerType: string) => pointerType !== 'touch' && pointerType !== 'pen'

/** A press that may turn into a drag; see `holdPointer`. */
export interface PointerHold {
  /** The drag has started: the touch stops scrolling and `root` captures the pointer. */
  grab(): void
  /** The press or the drag is over. */
  release(): void
}

/**
 * Keeps a touch on the drag it started, also when the element under the
 * finger is removed while it moves (the item moved to another list, a
 * virtual row scrolled out of view).
 *
 * Touch events keep going to the element the finger went down on, and a
 * removed element no longer passes them up to the page: nothing stops the
 * touch from scrolling, and the browser cancels the pointer to scroll
 * instead. So the element gets its own `touchmove` listener, next to one on
 * the window. Call this in `pointerdown`: it comes before `touchstart`, and
 * a touch can only be kept from scrolling when a listener on the window was
 * there as it started (one on the element alone is not seen in time). Call
 * `grab()` once the drag starts and `release()` when it ends.
 *
 * `root` is an element that stays in the page for the whole drag; it
 * captures the pointer, so its events go on without the element. Leave it
 * out when the element itself captures the pointer and is never removed.
 *
 * The hold also lets go by itself once the last finger is lifted, whether
 * or not the `pointerup` reached the code that would call `release()`
 * (Safari on iOS sends it to a removed element, where nothing hears it):
 * a hold that outlived its touch would keep the whole page from scrolling.
 * The drag is then cancelled the usual way: a `pointercancel` for the same
 * pointer goes out from the pressed element (or `root`, or the window, when
 * it is gone), so code that ends a drag on `pointercancel` ends it here too.
 * `onLost` is called after it.
 */
export function holdPointer(
  event: PointerEvent,
  root?: Element | null,
  onLost?: () => void,
): PointerHold {
  // A mouse never scrolls the page by dragging.
  if (event.pointerType === 'mouse') return { grab() {}, release() {} }
  const target = event.target instanceof Element ? event.target : null
  let grabbed = false
  let held = true
  const block = (e: Event) => {
    if (grabbed && e.cancelable) e.preventDefault()
  }
  // After the pointer's own events, so a `pointerup` that did arrive ends the drag first.
  const end = (e: Event) => {
    if ((e as TouchEvent).touches?.length) return
    setTimeout(() => {
      if (!held) return
      release()
      const at = target?.isConnected ? target : root?.isConnected ? root : window
      at.dispatchEvent(
        new PointerEvent('pointercancel', {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          bubbles: true,
        }),
      )
      onLost?.()
    })
  }
  window.addEventListener('touchmove', block, { passive: false })
  target?.addEventListener('touchmove', block, { passive: false })
  for (const type of ['touchend', 'touchcancel']) {
    window.addEventListener(type, end, { passive: true })
    target?.addEventListener(type, end, { passive: true })
  }
  function release() {
    if (held) {
      held = false
      window.removeEventListener('touchmove', block)
      target?.removeEventListener('touchmove', block)
      for (const type of ['touchend', 'touchcancel']) {
        window.removeEventListener(type, end)
        target?.removeEventListener(type, end)
      }
    }
    if (!grabbed) return
    grabbed = false
    if (root?.isConnected && root.hasPointerCapture?.(event.pointerId))
      root.releasePointerCapture(event.pointerId)
  }
  return {
    grab() {
      if (grabbed || !held) return
      grabbed = true
      try {
        if (root?.isConnected) root.setPointerCapture?.(event.pointerId)
      } catch {
        // the pointer is already gone
      }
    },
    release,
  }
}
