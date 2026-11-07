import { shallowRef } from 'vue'
import { holdPointer } from '../../utils/pointer'
import type { TabsValue } from './tabs'

/** A tab being dragged. One at a time on the whole page. */
export interface TabDrag {
  value: TabsValue
  /** The tab's text, for the ghost and for what screen readers hear. */
  label: string
  /** The `group` of the tabs it comes from. */
  group: string | undefined
  /** The `name` of the tabs it comes from. */
  name: string | undefined
  /** Its index in the tabs it comes from. */
  index: number
  /** The tabs it comes from, to tell a move within them from one between tabs. */
  source: object
}

/** A place a tab can be dropped on: a row of tabs, or a group of a dock. */
export interface TabDropZone {
  el: () => Element | null | undefined
  accepts: (drag: TabDrag) => boolean
  /** The pointer is over the zone; show where the tab would go. */
  over: (drag: TabDrag, x: number, y: number) => void
  /** The pointer left the zone, or the drag ended. */
  leave: () => void
  drop: (drag: TabDrag) => void
}

const zones = new Map<Element, TabDropZone>()

/** The drag in progress, if any. */
export const activeTabDrag = shallowRef<TabDrag | null>(null)

export function registerTabDropZone(zone: TabDropZone) {
  let el: Element | null | undefined
  return {
    /** Call after the zone's element changes. */
    update() {
      const next = zone.el()
      if (next === el) return
      if (el) zones.delete(el)
      el = next
      if (el) zones.set(el, zone)
    },
    remove() {
      if (el) zones.delete(el)
      el = undefined
    },
  }
}

/** The innermost zone under the point that takes this tab. */
function zoneAt(drag: TabDrag, x: number, y: number) {
  let el = document.elementFromPoint(x, y)
  while (el) {
    const zone = zones.get(el)
    if (zone?.accepts(drag)) return zone
    el = el.parentElement
  }
  return undefined
}

export interface StartTabDragOptions {
  /** The tab element: it is copied for the ghost and dimmed while it moves. */
  el: HTMLElement
  /**
   * For a drag that starts on something other than a tab: the ghost is a
   * tab with this text, sized like the tabs of `tabs`, in place of a copy of `el`.
   */
  ghost?: { label: string; tabs: HTMLElement | null | undefined }
  /** An element that stays in the page for the whole drag, to capture the pointer. */
  root: HTMLElement | null
  drag: () => TabDrag
  onStart?: () => void
  /** The drag is over, dropped or not. */
  onEnd?: (dropped: boolean) => void
}

/**
 * Watch a press on a tab and turn it into a drag once the pointer moves
 * far enough. On touch the press has to be held first, so a swipe still
 * scrolls the row of tabs.
 */
export function pressTab(event: PointerEvent, options: StartTabDragOptions) {
  if (event.button !== 0 || activeTabDrag.value) return
  const start = { x: event.clientX, y: event.clientY }
  const press = event.pointerType === 'touch'
  let ready = !press
  let drag: TabDrag | null = null
  let ghost: HTMLElement | undefined
  let offset = { x: 0, y: 0 }
  let pointer = { x: 0, y: 0 }
  let current: TabDropZone | undefined
  let frame = 0
  const timer = press ? setTimeout(() => (ready = true), 250) : undefined
  const hold = holdPointer(event, options.root)

  function makeGhost(e: PointerEvent) {
    const rect = options.el.getBoundingClientRect()
    // below the pointer, off the row it moves along, so the mark where it drops stays in sight
    offset = { x: Math.min(e.clientX - rect.left, 16), y: -16 }
    let clone: HTMLElement
    if (options.ghost) {
      clone = document.createElement('div')
      clone.className = 'dou-tabs__tab'
      clone.textContent = options.ghost.label
    } else {
      clone = options.el.cloneNode(true) as HTMLElement
      clone.removeAttribute('id')
      clone.classList.remove('is-dragging')
      Object.assign(clone.style, { width: `${rect.width}px`, height: `${rect.height}px` })
    }
    clone.classList.add('dou-tabs-ghost')
    clone.setAttribute('aria-hidden', 'true')
    Object.assign(clone.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      margin: '0',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: '9999',
    })
    // the copy sits on `body`: keep the size and theme of the tabs it came from
    const tabs = options.ghost ? options.ghost.tabs : options.el.closest<HTMLElement>('.dou-tabs')
    if (tabs) {
      const style = getComputedStyle(tabs)
      for (const name of ['--dou-tabs-height', '--dou-tabs-padding-x', '--dou-tabs-icon-size'])
        clone.style.setProperty(name, style.getPropertyValue(name))
      clone.style.fontSize = style.fontSize
    }
    const theme = (tabs ?? options.el).closest<HTMLElement>('[data-dou-theme]')?.dataset.douTheme
    if (theme) clone.dataset.douTheme = theme
    document.body.append(clone)
    ghost = clone
    moveGhost()
  }
  function moveGhost() {
    if (ghost) ghost.style.translate = `${pointer.x - offset.x}px ${pointer.y - offset.y}px`
  }

  // checked every frame, so a row that scrolls under a still pointer stays right
  function tick() {
    if (!drag) return
    const zone = zoneAt(drag, pointer.x, pointer.y)
    if (zone !== current) current?.leave()
    current = zone
    zone?.over(drag, pointer.x, pointer.y)
    frame = requestAnimationFrame(tick)
  }

  function begin(e: PointerEvent) {
    drag = options.drag()
    activeTabDrag.value = drag
    hold.grab()
    document.documentElement.classList.add('dou-tabs-dragging')
    makeGhost(e)
    options.onStart?.()
    frame = requestAnimationFrame(tick)
  }

  function end(commit: boolean) {
    stop()
    cancelAnimationFrame(frame)
    ghost?.remove()
    document.documentElement.classList.remove('dou-tabs-dragging')
    const finished = drag
    drag = null
    activeTabDrag.value = null
    if (!finished) return
    // where the pointer is now, also when no frame ran since the last move
    const zone = commit ? zoneAt(finished, pointer.x, pointer.y) : undefined
    if (zone !== current) current?.leave()
    current = undefined
    if (zone) {
      // brought up to date with the pointer, then dropped on; it clears what it showed
      zone.over(finished, pointer.x, pointer.y)
      zone.drop(finished)
    }
    options.onEnd?.(!!zone)
  }

  const onMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY }
    if (!drag) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 4) return
      if (!ready) return stop()
      begin(e)
    }
    e.preventDefault()
    moveGhost()
  }
  const onUp = () => (drag ? end(true) : stop())
  const onCancel = () => (drag ? end(false) : stop())
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !drag) return
    e.preventDefault()
    e.stopPropagation()
    end(false)
  }
  function stop() {
    clearTimeout(timer)
    hold.release()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
}
