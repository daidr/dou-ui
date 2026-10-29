import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { getScrollParent, isWindow } from '../../utils/scroll'

export type SortableDirection = 'vertical' | 'horizontal' | 'grid'

export interface SortableMoveEvent<T> {
  item: T
  oldIndex: number
  newIndex: number
}

/** What the live region says; each function gets 1-based positions. */
export interface SortableMessages {
  /** What an item is, for `aria-roledescription`. */
  item: string
  lifted: (label: string, position: number, total: number) => string
  moved: (label: string, position: number, total: number) => string
  dropped: (label: string, position: number, total: number) => string
  canceled: (label: string) => string
}

export interface UseSortableOptions<T> {
  /** The list. It is only replaced when an item is dropped, never changed in place. */
  items: Ref<T[]>
  /** Each item's key, the same one used for `v-for`. */
  key: (item: T) => PropertyKey
  /** Lists with the same group pass items between each other. */
  group?: () => string | undefined
  /** Only start dragging from an element marked with `data-dou-sortable-handle`. */
  handle?: () => boolean
  disabled?: () => boolean
  /** Which arrow keys move an item: up / down, left / right, or both. */
  direction?: () => SortableDirection
  /** Names an item in what screen readers hear. */
  label?: (item: T, index: number) => string
  messages: () => SortableMessages
  /** An item moved within this list. */
  onSort?: (event: SortableMoveEvent<T>) => void
  /** An item came in from another list of the group. */
  onAdd?: (event: SortableMoveEvent<T>) => void
  /** An item left for another list of the group. */
  onRemove?: (event: SortableMoveEvent<T>) => void
}

/** One list taking part in a drag. */
interface Sortable {
  el: () => HTMLElement | null | undefined
  group: () => string | undefined
  disabled: () => boolean
  key: (item: unknown) => PropertyKey
  /** The order shown during a drag; `null` when the list is at rest. */
  working: Ref<unknown[] | null>
  items: () => unknown[]
  commit: (list: unknown[]) => void
  emitSort: (event: SortableMoveEvent<unknown>) => void
  emitAdd: (event: SortableMoveEvent<unknown>) => void
  emitRemove: (event: SortableMoveEvent<unknown>) => void
}

interface Drag {
  item: unknown
  key: PropertyKey
  source: Sortable
  sourceIndex: number
  current: Sortable
  index: number
  /** The item last swapped with, ignored until the pointer leaves it. */
  passed?: Element
  keyboard: boolean
}

const lists = new WeakMap<Element, Sortable>()
const ITEM = 'data-dou-sortable-key'
const LIST = 'data-dou-sortable'

/** The single drag in progress, shared by all lists so items can cross between them. */
const active = shallowRef<Drag | null>(null)

const isInteractive = (el: Element) =>
  !!el.closest('input, textarea, select, button, a[href], [contenteditable], [role="slider"]')

function move<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/* moving the item while dragging */

const shown = (sortable: Sortable) => sortable.working.value ?? sortable.items()

/** Show the dragged item at `index` of `target`, taking it out of the list it is in now. */
function place(drag: Drag, target: Sortable, index: number) {
  if (target === drag.current) {
    if (index === drag.index) return
    target.working.value = move(shown(target), drag.index, index)
  } else {
    const from = shown(drag.current).filter((item) => drag.current.key(item) !== drag.key)
    drag.current.working.value = from
    const to = [...shown(target)]
    to.splice(index, 0, drag.item)
    target.working.value = to
    drag.current = target
  }
  drag.index = index
}

/** Put everything back as it was before the drag. */
function reset(drag: Drag) {
  drag.source.working.value = null
  drag.current.working.value = null
}

/** Write the new order back to the lists involved and tell them. */
function finish(drag: Drag) {
  const { source, current, item, sourceIndex, index } = drag
  const event = { item, oldIndex: sourceIndex, newIndex: index }
  if (current === source) {
    const next = source.working.value
    source.working.value = null
    if (next && index !== sourceIndex) {
      source.commit(next)
      source.emitSort(event)
    }
    return
  }
  const from = source.working.value ?? source.items()
  const to = current.working.value ?? current.items()
  source.working.value = null
  current.working.value = null
  source.commit(from)
  current.commit(to)
  source.emitRemove(event)
  current.emitAdd(event)
}

/** The list and the item under the pointer. */
function hit(drag: Drag, x: number, y: number) {
  const el = document.elementFromPoint(x, y)
  const listEl = el?.closest(`[${LIST}]`)
  const target = listEl ? lists.get(listEl) : undefined
  if (!target || target.disabled()) return
  if (target !== drag.current) {
    const group = drag.source.group()
    if (!group || target.group() !== group) return
  }
  const itemEl = el!.closest(`[${ITEM}]`)
  return { target, itemEl: itemEl?.closest(`[${LIST}]`) === listEl ? itemEl : null }
}

function onDragMove(x: number, y: number) {
  const drag = active.value
  if (!drag) return
  const found = hit(drag, x, y)
  if (!found) return
  const { target, itemEl } = found
  if (drag.passed && itemEl !== drag.passed) drag.passed = undefined
  const items = shown(target)
  if (!itemEl) {
    // Over the list but off its items: an empty list, or past the last item.
    if (target !== drag.current) place(drag, target, items.length)
    return
  }
  if (itemEl === drag.passed) return
  const index = items.findIndex((item) => String(target.key(item)) === itemEl.getAttribute(ITEM))
  if (index < 0 || (target === drag.current && index === drag.index)) return
  drag.passed = itemEl
  place(drag, target, index)
}

/**
 * Drag to reorder the children of a container. Bind `listAttrs` on the
 * container and `itemAttrs(item, index)` on each child, and render
 * `list` instead of the items: it shows the order while dragging. Wrap
 * the children in a `<TransitionGroup>` for items to slide into place.
 *
 * Keyboard: Space or Enter picks the focused item up, the arrow keys
 * move it, Space or Enter puts it down and Escape puts it back.
 */
export function useSortable<T>(options: UseSortableOptions<T>) {
  const container = ref<HTMLElement | null>(null)
  const working = ref<T[] | null>(null) as Ref<T[] | null>
  const list: ComputedRef<T[]> = computed(() => working.value ?? options.items.value)
  const announcement = ref('')

  const self: Sortable = {
    el: () => container.value,
    group: () => options.group?.(),
    disabled: () => !!options.disabled?.(),
    key: options.key as (item: unknown) => PropertyKey,
    working: working as Ref<unknown[] | null>,
    items: () => options.items.value,
    commit: (next) => (options.items.value = next as T[]),
    emitSort: (event) => options.onSort?.(event as SortableMoveEvent<T>),
    emitAdd: (event) => options.onAdd?.(event as SortableMoveEvent<T>),
    emitRemove: (event) => options.onRemove?.(event as SortableMoveEvent<T>),
  }

  watch(container, (el, old) => {
    if (old) lists.delete(old)
    if (el) lists.set(el, self)
  })

  const labelOf = (item: unknown, index: number) =>
    options.label?.(item as T, index) ?? String(index + 1)
  function say(text: string) {
    announcement.value = text
    announce(text)
  }

  /* the pointer */

  let ghost: HTMLElement | undefined
  let offset = { x: 0, y: 0 }
  let pointer = { x: 0, y: 0 }
  let frame = 0

  function makeGhost(el: HTMLElement, event: PointerEvent) {
    const rect = el.getBoundingClientRect()
    offset = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const clone = el.cloneNode(true) as HTMLElement
    clone.removeAttribute('id')
    clone.removeAttribute(ITEM)
    clone.classList.remove('is-dragging')
    clone.classList.add('dou-sortable-ghost')
    clone.setAttribute('aria-hidden', 'true')
    Object.assign(clone.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: '9999',
    })
    // Keep the theme of the list the item came from.
    const theme = el.closest<HTMLElement>('[data-dou-theme]')?.dataset.douTheme
    if (theme) clone.dataset.douTheme = theme
    document.body.append(clone)
    ghost = clone
    moveGhost(event.clientX, event.clientY)
  }
  function moveGhost(x: number, y: number) {
    if (ghost) ghost.style.translate = `${x - offset.x}px ${y - offset.y}px`
  }

  /** Scroll the list's scroll area, or the window, while the pointer is near its edge. */
  function autoScroll() {
    const drag = active.value
    if (!drag || drag.keyboard) return
    const el = drag.current.el()
    const area = el ? (getComputedStyleScrolls(el) ? el : getScrollParent(el)) : window
    const box = isWindow(area)
      ? { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }
      : area.getBoundingClientRect()
    const EDGE = 40
    const speed = (d: number) => Math.ceil(((EDGE - d) / EDGE) * 12)
    let dx = 0
    let dy = 0
    if (pointer.y - box.top < EDGE) dy = -speed(pointer.y - box.top)
    else if (box.bottom - pointer.y < EDGE) dy = speed(box.bottom - pointer.y)
    if (pointer.x - box.left < EDGE) dx = -speed(pointer.x - box.left)
    else if (box.right - pointer.x < EDGE) dx = speed(box.right - pointer.x)
    if (dx || dy) {
      area.scrollBy(dx, dy)
      onDragMove(pointer.x, pointer.y)
    }
    frame = requestAnimationFrame(autoScroll)
  }

  let cleanup: (() => void) | undefined

  function endPointer(commit: boolean) {
    cleanup?.()
    cleanup = undefined
    cancelAnimationFrame(frame)
    ghost?.remove()
    ghost = undefined
    document.documentElement.classList.remove('dou-sortable-dragging')
    const drag = active.value
    active.value = null
    if (!drag) return
    if (commit) finish(drag)
    else reset(drag)
  }

  function onPointerDown(event: PointerEvent, item: T, index: number) {
    if (event.button !== 0 || self.disabled() || active.value) return
    const target = event.target as Element
    const itemEl = event.currentTarget as HTMLElement
    const fromHandle = !!target.closest('[data-dou-sortable-handle]')
    if (options.handle?.() ? !fromHandle : !fromHandle && isInteractive(target)) return

    const start = { x: event.clientX, y: event.clientY }
    // On touch, dragging a whole item needs a short press, so a swipe still scrolls.
    const press = event.pointerType === 'touch' && !fromHandle
    let ready = !press
    let started = false
    const timer = press ? setTimeout(() => (ready = true), 250) : undefined

    const begin = (e: PointerEvent) => {
      started = true
      active.value = {
        item,
        key: options.key(item),
        source: self,
        sourceIndex: index,
        current: self,
        index,
        keyboard: false,
      }
      document.documentElement.classList.add('dou-sortable-dragging')
      makeGhost(itemEl, e)
      frame = requestAnimationFrame(autoScroll)
    }
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
      if (!started) {
        const far = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4
        if (!far) return
        if (!ready) return stop()
        begin(e)
      }
      e.preventDefault()
      moveGhost(e.clientX, e.clientY)
      onDragMove(e.clientX, e.clientY)
    }
    const onUp = () => (started ? endPointer(true) : stop())
    const onCancel = () => (started ? endPointer(false) : stop())
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !started) return
      e.preventDefault()
      endPointer(false)
    }
    // Once dragging, a touch must not scroll the page as well.
    const onTouchMove = (e: TouchEvent) => {
      if (started) e.preventDefault()
    }
    const stop = () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('touchmove', onTouchMove)
    }
    cleanup = stop
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
  }

  /* the keyboard */

  /** Put focus back on the item (or its handle) after it moved in the page. */
  function refocus(key: PropertyKey) {
    void nextTick(() => {
      const el = container.value?.querySelector<HTMLElement>(
        `[${ITEM}="${CSS.escape(String(key))}"]`,
      )
      const target = options.handle?.()
        ? el?.querySelector<HTMLElement>('[data-dou-sortable-handle]')
        : el
      target?.focus()
    })
  }

  function onKeydown(event: KeyboardEvent, item: T, index: number) {
    if (self.disabled()) return
    const target = event.target as Element
    if (
      options.handle?.()
        ? !target.closest('[data-dou-sortable-handle]')
        : target !== event.currentTarget
    )
      return
    const drag = active.value
    const messages = options.messages()
    const total = () => shown(self).length

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!drag) {
        active.value = {
          item,
          key: options.key(item),
          source: self,
          sourceIndex: index,
          current: self,
          index,
          keyboard: true,
        }
        say(messages.lifted(labelOf(item, index), index + 1, total()))
      } else if (drag.keyboard) {
        active.value = null
        finish(drag)
        say(messages.dropped(labelOf(drag.item, drag.index), drag.index + 1, total()))
        refocus(drag.key)
      }
      return
    }
    if (!drag?.keyboard) return
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault()
      active.value = null
      reset(drag)
      say(messages.canceled(labelOf(drag.item, drag.sourceIndex)))
      refocus(drag.key)
      return
    }
    const direction = options.direction?.() ?? 'vertical'
    const back =
      (direction !== 'horizontal' && event.key === 'ArrowUp') ||
      (direction !== 'vertical' && event.key === 'ArrowLeft')
    const forward =
      (direction !== 'horizontal' && event.key === 'ArrowDown') ||
      (direction !== 'vertical' && event.key === 'ArrowRight')
    const home = event.key === 'Home'
    const end = event.key === 'End'
    if (!back && !forward && !home && !end) return
    event.preventDefault()
    const last = total() - 1
    const next = home ? 0 : end ? last : Math.min(Math.max(drag.index + (back ? -1 : 1), 0), last)
    if (next === drag.index) return
    place(drag, self, next)
    say(messages.moved(labelOf(drag.item, next), next + 1, total()))
    refocus(drag.key)
  }

  onBeforeUnmount(() => {
    if (container.value) lists.delete(container.value)
    const drag = active.value
    if (drag && (drag.source === self || drag.current === self)) {
      if (drag.keyboard) {
        active.value = null
        reset(drag)
      } else endPointer(false)
    }
  })

  const dragging = computed(() => {
    const drag = active.value
    return drag && (drag.current === self || drag.source === self) ? drag.key : null
  })

  const listAttrs = computed(() => ({ [LIST]: '' }))

  function itemAttrs(item: T, index: number) {
    const key = options.key(item)
    const handle = !!options.handle?.()
    const lifted = active.value?.keyboard && active.value.key === key
    return {
      [ITEM]: String(key),
      class: { 'is-dragging': dragging.value === key, 'is-lifted': lifted },
      tabindex: handle || self.disabled() ? undefined : 0,
      'aria-roledescription': handle ? undefined : options.messages().item,
      onPointerdown: (event: PointerEvent) => onPointerDown(event, item, index),
      onKeydown: (event: KeyboardEvent) => onKeydown(event, item, index),
    }
  }

  return { container, list, dragging, announcement, listAttrs, itemAttrs }
}

let region: HTMLElement | undefined
/** Read a message out through one live region shared by every list. */
function announce(text: string) {
  if (!region?.isConnected) {
    region = document.createElement('div')
    region.className = 'dou-sortable-live'
    region.setAttribute('aria-live', 'assertive')
    region.setAttribute('aria-atomic', 'true')
    document.body.append(region)
  }
  // Clear first, so the same message twice is read twice.
  region.textContent = ''
  requestAnimationFrame(() => region && (region.textContent = text))
}

function getComputedStyleScrolls(el: HTMLElement) {
  const style = getComputedStyle(el)
  return /(auto|scroll|overlay)/.test(style.overflowY + style.overflowX)
}
