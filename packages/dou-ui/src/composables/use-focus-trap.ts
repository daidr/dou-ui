import { nextTick, onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

/** The elements inside `container` reachable with `Tab`, in order. */
export function getTabbable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.tabIndex >= 0 && !element.closest('[inert], [hidden]'),
  )
}

interface Trap {
  contains: (target: Node) => boolean
  container: () => HTMLElement | null
}

const traps: Trap[] = []

function onFocusin(event: FocusEvent) {
  const trap = traps.at(-1)
  const target = event.target
  if (!trap || !(target instanceof Node) || trap.contains(target)) return
  const container = trap.container()
  if (!container) return
  ;(getTabbable(container)[0] ?? container).focus()
}

export interface UseFocusTrapOptions {
  active: MaybeRefOrGetter<boolean>
  /**
   * Whether a node counts as inside the trap. Defaults to the container;
   * pass a layer's `contains` so menus opened from inside stay reachable.
   */
  contains?: (target: Node) => boolean
  /** The element to focus first. Defaults to `[autofocus]`, then the first tabbable element. */
  initialFocus?: () => HTMLElement | null | undefined
}

/**
 * Keep focus inside `container` while active: `Tab` wraps around, and
 * focus that escapes is brought back. Focus returns to where it was
 * when the trap is released.
 */
export function useFocusTrap(container: Ref<HTMLElement | null>, options: UseFocusTrapOptions) {
  const trap: Trap = {
    contains: (target) =>
      options.contains ? options.contains(target) : !!container.value?.contains(target),
    container: () => container.value,
  }
  let returnTo: HTMLElement | null = null

  function onKeydown(event: KeyboardEvent) {
    const root = container.value
    if (event.key !== 'Tab' || !root || traps.at(-1) !== trap) return
    if (!(event.target instanceof Node) || !root.contains(event.target)) return
    const tabbable = getTabbable(root)
    const first = tabbable[0]
    const last = tabbable.at(-1)
    if (!first || !last) {
      event.preventDefault()
      return
    }
    const current = document.activeElement
    if (event.shiftKey && (current === first || current === root)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function activate() {
    if (traps.includes(trap)) return
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!traps.length) document.addEventListener('focusin', onFocusin)
    traps.push(trap)
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    const root = container.value
    if (!root || root.contains(document.activeElement)) return
    const target =
      options.initialFocus?.() ??
      root.querySelector<HTMLElement>('[autofocus]') ??
      getTabbable(root)[0] ??
      root
    target.focus({ preventScroll: true })
  }

  function deactivate() {
    const index = traps.indexOf(trap)
    if (index < 0) return
    traps.splice(index, 1)
    document.removeEventListener('keydown', onKeydown)
    if (!traps.length) document.removeEventListener('focusin', onFocusin)
    const target = returnTo
    returnTo = null
    // Only hand focus back if it is still inside the trap or lost to <body>.
    const current = document.activeElement
    if (target?.isConnected && (!current || current === document.body || trap.contains(current))) {
      target.focus({ preventScroll: true })
    }
  }

  watch(
    () => toValue(options.active),
    (active) => {
      if (typeof document === 'undefined') return
      if (active) void activate()
      else deactivate()
    },
    { immediate: true },
  )
  onScopeDispose(deactivate)
}
