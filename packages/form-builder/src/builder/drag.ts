import { holdPointer } from 'dou-ui'
import type { PointerHold } from 'dou-ui'
import type { FormNode } from '../core/types'
import { formatMessage } from '../locale'
import type { FormFieldType } from '../fields/define'
import type { BuilderState } from './context'
import type { FormBuilderInsertPlace } from './core/commands'
import { dropPlaces, topmost } from './core/commands'
import { canContainFormNode, formNodePlaces } from './core/transaction'
import { nodeTitle } from './settings'

/** How far a mouse moves before a press becomes a drag, in px. */
const DRAG_DISTANCE = 4
/** How long a finger rests on a node before it is picked up, in ms. */
const HOLD_DELAY = 300
/** How far a finger may move while resting, in px; further is a scroll. */
const HOLD_SLOP = 8
/** The band at the top and bottom of the canvas that scrolls it while dragging, in px. */
const EDGE = 48
/** The fastest the canvas scrolls while dragging, in px per frame. */
const EDGE_SPEED = 18

/** A rectangle in the coordinates of the canvas's content, so scrolling does not change it. */
interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

interface HolderBox extends Box {
  /** The container whose children the grid holds; `null` for the top of the form. */
  id: string | null
  /** Its children on the canvas, in order. */
  children: ChildBox[]
}

interface ChildBox extends Box {
  id: string
}

/** Where a drop goes, and how to draw it. */
export interface DropTarget extends FormBuilderInsertPlace {
  /** The line between nodes, in the canvas's content coordinates. */
  line: { left: number; top: number; length: number; vertical: boolean }
  /** The grid the node goes into. */
  holder: Box
}

/** What is being dragged: nodes of the canvas, or a new node of a type from the palette. */
export type DragSource = { kind: 'nodes'; ids: string[] } | { kind: 'type'; type: string }

/** The parts the canvas draws for a drag; the controller moves them without rendering. */
export interface DragLayer {
  indicator: HTMLElement | null
  holder: HTMLElement | null
  ghost: HTMLElement | null
}

export interface DragController {
  /** A press on a node of the canvas: becomes a drag after a move (mouse) or a rest (touch). */
  pressNode: (event: PointerEvent, id: string) => void
  /** A press on an entry of the palette. */
  pressType: (event: PointerEvent, type: string, label: string) => void
  /** Whether the click that ends a drag should be ignored. */
  swallowClick: () => boolean
  /** Pick up the selected nodes to move them with the keyboard. */
  pickUp: () => boolean
  /** Keys while nodes are picked up; returns whether the key was used. */
  keydown: (event: KeyboardEvent) => boolean
  /** Whether nodes are picked up with the keyboard. */
  readonly carrying: boolean
  stop: () => void
}

const contains = (box: Box, x: number, y: number) =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom

export function createDragController(
  state: BuilderState,
  scroller: () => HTMLElement | null,
  layer: DragLayer,
): DragController {
  let holders: HolderBox[] = []
  let source: DragSource | null = null
  let dragged: FormNode[] = []
  let target: DropTarget | null = null
  let pointer = { x: 0, y: 0 }
  let frame = 0
  let measuredAt = 0
  let swallow = false
  let cleanup: (() => void) | null = null
  // Keyboard: the places in reading order and the one shown.
  let places: FormBuilderInsertPlace[] | null = null
  let placeAt = 0

  const root = () => scroller()
  const contentPoint = (x: number, y: number) => {
    const el = root()!
    const rect = el.getBoundingClientRect()
    return { x: x - rect.left + el.scrollLeft, y: y - rect.top + el.scrollTop }
  }

  /** Read every grid and node of the canvas once; moving the pointer then only does math. */
  function measure() {
    const el = root()
    if (!el) return
    const base = el.getBoundingClientRect()
    const box = (node: Element): Box => {
      const rect = node.getBoundingClientRect()
      const left = rect.left - base.left + el.scrollLeft
      const top = rect.top - base.top + el.scrollTop
      return { left, top, right: left + rect.width, bottom: top + rect.height }
    }
    const hidden = new Set(dragged.map((node) => node.id))
    holders = []
    for (const grid of el.querySelectorAll<HTMLElement>('[data-holder]')) {
      // Grids inside the dragged nodes take no drops.
      const owner = grid.closest<HTMLElement>('[data-node]')
      let inside = false
      for (let up: HTMLElement | null = owner; up;) {
        if (hidden.has(up.dataset.node!)) inside = true
        up = up.parentElement?.closest<HTMLElement>('[data-node]') ?? null
      }
      if (inside) continue
      const children: ChildBox[] = []
      for (const child of grid.children)
        if (child instanceof HTMLElement && child.dataset.node)
          children.push({ id: child.dataset.node, ...box(child) })
      holders.push({ id: grid.dataset.holder || null, children, ...box(grid) })
    }
    measuredAt = performance.now()
  }

  /** The place under a point: the innermost grid that takes the nodes, and the gap nearest. */
  function hit(x: number, y: number): DropTarget | null {
    const map = formNodePlaces(state.document)
    const probe: FormNode[] = dragged.length
      ? dragged
      : [{ id: '', type: (source as { type: string }).type } as FormNode]
    const fits = (holder: HolderBox) => {
      const node = holder.id === null ? null : map.get(holder.id)?.node
      if (node === undefined) return false
      return probe.every((each) => canContainFormNode(node, each))
    }
    // Grids come in document order, so the last one around the point is the innermost.
    let chosen: HolderBox | undefined
    for (const holder of holders) if (contains(holder, x, y) && fits(holder)) chosen = holder
    chosen ??= holders.find((holder) => holder.id === null)
    if (!chosen) return null
    const children = chosen.children
    if (!children.length)
      return {
        parent: chosen.id,
        index: 0,
        holder: chosen,
        line: {
          left: chosen.left,
          top: chosen.top,
          length: chosen.right - chosen.left,
          vertical: false,
        },
      }
    // The child nearest the point, then which side of it.
    let best = children[0]!
    let bestIndex = 0
    let bestDistance = Infinity
    children.forEach((child, index) => {
      const dx = x < child.left ? child.left - x : x > child.right ? x - child.right : 0
      const dy = y < child.top ? child.top - y : y > child.bottom ? y - child.bottom : 0
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = child
        bestIndex = index
      }
    })
    const width = chosen.right - chosen.left
    const beside = best.right - best.left < width - 2 && y >= best.top && y <= best.bottom
    let after: boolean
    let line: DropTarget['line']
    if (beside) {
      after = x > (best.left + best.right) / 2
      line = {
        left: after ? best.right + 4 : best.left - 4,
        top: best.top,
        length: best.bottom - best.top,
        vertical: true,
      }
    } else {
      after = y > (best.top + best.bottom) / 2
      line = {
        left: best.left,
        top: after ? best.bottom + 6 : best.top - 6,
        length: best.right - best.left,
        vertical: false,
      }
    }
    return { parent: chosen.id, index: bestIndex + (after ? 1 : 0), holder: chosen, line }
  }

  function draw() {
    const { indicator, holder } = layer
    if (indicator) {
      indicator.hidden = !target
      if (target) {
        const { left, top, length, vertical } = target.line
        indicator.dataset.vertical = String(vertical)
        indicator.style.transform = `translate(${left}px, ${top}px)`
        indicator.style.setProperty('--dou-form-builder-drop-length', `${length}px`)
      }
    }
    if (holder) {
      // The top of the form shows no tint: the line is enough there.
      holder.hidden = !target || target.parent === null
      if (target && target.parent !== null) {
        const box = target.holder
        holder.style.transform = `translate(${box.left}px, ${box.top}px)`
        holder.style.width = `${box.right - box.left}px`
        holder.style.height = `${box.bottom - box.top}px`
      }
    }
  }

  function moveGhost() {
    if (layer.ghost)
      layer.ghost.style.transform = `translate(${pointer.x + 12}px, ${pointer.y + 12}px)`
  }

  /** Dim the nodes being dragged where they were. */
  function markDragged(on: boolean) {
    const el = root()
    if (!el) return
    // A data attribute, not a class: rendering the node keeps it.
    for (const node of dragged) {
      const item = el.querySelector<HTMLElement>(`[data-node="${CSS.escape(node.id)}"]`)
      if (!item) continue
      if (on) item.dataset.dragged = ''
      else delete item.dataset.dragged
    }
  }

  /** Each frame: scroll near the edges, then find and draw the place under the pointer. */
  function tick() {
    frame = 0
    const el = root()
    if (!el || !source) return
    const rect = el.getBoundingClientRect()
    let speed = 0
    if (pointer.y < rect.top + EDGE) speed = -((rect.top + EDGE - pointer.y) / EDGE)
    else if (pointer.y > rect.bottom - EDGE) speed = (pointer.y - (rect.bottom - EDGE)) / EDGE
    speed = Math.max(-1, Math.min(1, speed)) * EDGE_SPEED
    if (speed) {
      const before = el.scrollTop
      el.scrollTop += speed
      // Fields drawn while scrolling change the layout: read it again now and then.
      if (el.scrollTop !== before && performance.now() - measuredAt > 200) measure()
    }
    const point = contentPoint(pointer.x, pointer.y)
    target = hit(point.x, point.y)
    draw()
    moveGhost()
    if (speed) frame = requestAnimationFrame(tick)
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function begin(next: DragSource, label: string) {
    source = next
    dragged =
      next.kind === 'nodes'
        ? next.ids
            .map((id) => formNodePlaces(state.document).get(id)?.node)
            .filter((node): node is FormNode => !!node)
        : []
    measure()
    markDragged(true)
    if (layer.ghost) {
      layer.ghost.hidden = false
      layer.ghost.textContent = label
    }
    root()?.classList.add('is-dragging')
    document.documentElement.classList.add('dou-form-builder-dragging')
    schedule()
  }

  function end(drop: boolean) {
    cancelAnimationFrame(frame)
    frame = 0
    markDragged(false)
    const was = source
    const place = target
    source = null
    target = null
    dragged = []
    holders = []
    draw()
    if (layer.ghost) layer.ghost.hidden = true
    root()?.classList.remove('is-dragging')
    document.documentElement.classList.remove('dou-form-builder-dragging')
    if (!drop || !was || !place) return
    if (was.kind === 'type') state.add(was.type, { parent: place.parent, index: place.index })
    else state.moveTo({ parent: place.parent, index: place.index }, was.ids)
  }

  /** Follow a pointer after a press until it is let go. */
  function track(
    event: PointerEvent,
    options: { touchHold: boolean; start: () => [DragSource, string] | null },
  ) {
    cleanup?.()
    const startX = event.clientX
    const startY = event.clientY
    const touch = event.pointerType !== 'mouse'
    const hold: PointerHold | null = touch ? holdPointer(event, root()) : null
    let started = false
    let timer = 0

    const launch = () => {
      const picked = options.start()
      if (!picked) return stopAll(false)
      started = true
      hold?.grab()
      begin(...picked)
    }
    if (touch && options.touchHold) timer = window.setTimeout(launch, HOLD_DELAY)

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return
      pointer = { x: e.clientX, y: e.clientY }
      const distance = Math.hypot(e.clientX - startX, e.clientY - startY)
      if (!started) {
        if (touch) {
          // A finger that moves before the rest is over scrolls the page instead.
          if (distance > HOLD_SLOP) stopAll(false)
          return
        }
        if (distance < DRAG_DISTANCE) return
        launch()
      }
      schedule()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return
      stopAll(started)
    }
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId === event.pointerId) stopAll(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !started) return
      e.preventDefault()
      e.stopPropagation()
      stopAll(false)
    }
    function stopAll(drop: boolean) {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      hold?.release()
      cleanup = null
      if (started) {
        // The click that ends the drag is not a press on what is under it.
        swallow = true
        setTimeout(() => (swallow = false))
        end(drop)
      }
    }
    pointer = { x: startX, y: startY }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    cleanup = () => stopAll(false)
  }

  function pressNode(event: PointerEvent, id: string) {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return
    track(event, {
      touchHold: true,
      start: () => {
        // Dragging an unselected node moves it alone; a selected one takes the selection along.
        if (!state.selected.value.has(id)) state.select(id)
        const ids = topmost(state.document, state.selection)
        if (!ids.length) return null
        const map = formNodePlaces(state.document)
        const first = map.get(ids[0]!)?.node
        const label =
          ids.length > 1
            ? `${first ? titleOf(state, first) : ''} +${ids.length - 1}`
            : first
              ? titleOf(state, first)
              : ''
        return [{ kind: 'nodes', ids }, label]
      },
    })
  }

  function pressType(event: PointerEvent, type: string, label: string) {
    if (event.button !== 0) return
    // On touch the palette scrolls and a tap adds: only a mouse or a pen drags from it.
    if (event.pointerType === 'touch') return
    // No text selection while dragging from the palette; the click still adds.
    event.preventDefault()
    track(event, { touchHold: false, start: () => [{ kind: 'type', type }, label] })
  }

  // ---- Keyboard ----

  function showPlace(prefix = '') {
    const place = places?.[placeAt]
    if (!place) return
    measure()
    const holder = holders.find((each) => each.id === place.parent)
    if (!holder) {
      target = null
      return draw()
    }
    const child = holder.children[place.index]
    const prev = holder.children[place.index - 1]
    const line: DropTarget['line'] = child
      ? { left: child.left, top: child.top - 6, length: child.right - child.left, vertical: false }
      : prev
        ? { left: prev.left, top: prev.bottom + 6, length: prev.right - prev.left, vertical: false }
        : {
            left: holder.left,
            top: holder.top,
            length: holder.right - holder.left,
            vertical: false,
          }
    target = { ...place, holder, line }
    draw()
    const el = root()
    if (el) {
      const top = line.top - el.scrollTop
      if (top < EDGE || top > el.clientHeight - EDGE) el.scrollTop = line.top - el.clientHeight / 2
    }
    state.announce(prefix + describe(place))
  }

  function describe(place: FormBuilderInsertPlace) {
    const messages = state.messages
    const holder =
      place.parent === null ? null : formNodePlaces(state.document).get(place.parent)?.node
    const where = holder ? titleOf(state, holder) : messages.drag.top
    return formatMessage(messages.drag.place, { where, index: place.index + 1 })
  }

  function pickUp() {
    const ids = topmost(state.document, state.selection)
    if (!ids.length) return false
    const list = dropPlaces(state.document, ids, state.shownPage)
    if (!list.length) return false
    const own = formNodePlaces(state.document).get(ids[0]!)!
    places = list
    placeAt = Math.max(
      0,
      list.findIndex(
        (place) => place.parent === (own.parent?.id ?? null) && place.index === own.index,
      ),
    )
    source = { kind: 'nodes', ids }
    dragged = ids.map((id) => formNodePlaces(state.document).get(id)!.node)
    markDragged(true)
    root()?.classList.add('is-dragging')
    showPlace(state.messages.drag.picked)
    return true
  }

  function keydown(event: KeyboardEvent) {
    if (!places) return false
    const key = event.key
    if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowDown' || key === 'ArrowRight') {
      const delta = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1
      placeAt = Math.min(Math.max(placeAt + delta, 0), places.length - 1)
      showPlace()
    } else if (key === 'Home' || key === 'End') {
      placeAt = key === 'Home' ? 0 : places.length - 1
      showPlace()
    } else if (key === 'Enter' || key === ' ') {
      const place = places[placeAt]!
      const ids = (source as { ids: string[] }).ids
      places = null
      finishKeyboard()
      state.moveTo(place, ids)
    } else if (key === 'Escape' || key === 'Tab') {
      places = null
      finishKeyboard()
      state.announce(state.messages.drag.cancelled)
      if (key === 'Tab') return false
    } else return true
    event.preventDefault()
    return true
  }

  function finishKeyboard() {
    markDragged(false)
    source = null
    target = null
    dragged = []
    holders = []
    draw()
    root()?.classList.remove('is-dragging')
  }

  return {
    pressNode,
    pressType,
    swallowClick: () => swallow,
    pickUp,
    keydown,
    get carrying() {
      return places !== null
    },
    stop() {
      cleanup?.()
      places = null
      finishKeyboard()
    },
  }
}

const titleOf = (state: BuilderState, node: FormNode) =>
  nodeTitle(node, state.fields as Map<string, FormFieldType>, state.messages)
