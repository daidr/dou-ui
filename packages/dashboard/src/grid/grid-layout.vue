<script setup lang="ts">
import { holdPointer, useElementSize, type PointerHold } from 'dou-ui'
import { computed, onBeforeUnmount, provide, ref, shallowRef, useId, useSlots, watch } from 'vue'
import {
  deriveLayout,
  findPlace,
  fitItem,
  layoutHeight,
  moveItem,
  moveItemBy,
  normalizeLayout,
  resizeItem,
  resizeItemBy,
} from '../layout/engine'
import type { GridItem, GridLayoutOptions } from '../layout/types'
import { format, useDashboardMessages } from '../locale'
import GridItemView, { gridItemKey } from './grid-item'
import { DEFAULT_BREAKPOINTS, DEFAULT_COLUMNS, gridTiers, type GridTier } from './tiers'
import type {
  GridChangeReason,
  GridDropItem,
  GridItemSlotProps,
  GridLayouts,
  GridLayoutEmits,
  GridLayoutExpose,
  GridLayoutProps,
  GridResizeHandle,
} from './types'

defineOptions({ name: 'DouGridLayout' })

const props = withDefaults(defineProps<Omit<GridLayoutProps, 'modelValue' | 'layouts'>>(), {
  columns: () => DEFAULT_COLUMNS,
  breakpoints: () => DEFAULT_BREAKPOINTS,
  rowHeight: 80,
  gap: 16,
  compact: 'vertical',
  resize: true,
})
const emit = defineEmits<Omit<GridLayoutEmits, 'update:modelValue' | 'update:layouts'>>()
defineSlots<{
  item?: (props: GridItemSlotProps) => unknown
  placeholder?: (props: { item: GridItem }) => unknown
}>()

const model = defineModel<GridItem[]>({ default: () => [] })
const layouts = defineModel<GridLayouts>('layouts', { default: () => ({}) })
const messages = useDashboardMessages(() => props.messages)
const slots = useSlots()
const hintId = `${useId()}-hint`
provide(gridItemKey, { slots, hintId, resizeLabel: () => messages.value.resize })

/** How far a mouse moves before a press becomes a move, in px. */
const DRAG_DISTANCE = 4
/** How long a finger rests on an item before it is picked up, in ms. */
const HOLD_DELAY = 400
/** How far a finger may move while resting, in px; further is a scroll. */
const HOLD_SLOP = 8
/** The band along the top and bottom of the scrolling area that scrolls it during a drag, in px. */
const EDGE = 56
/** The fastest that band scrolls, in px per frame. */
const EDGE_SPEED = 20
/** How long items keep their transition after a drop, in ms (a little over the motion token). */
const SETTLE = 320

const root = ref<HTMLElement>()

// ---------------------------------------------------------------------------
// Breakpoints: the grid's own width picks how many columns it has

type Tier = GridTier

const tiers = computed(() => gridTiers(props.columns, props.breakpoints))
const { width: gridWidth } = useElementSize(root)
const tier = computed(() => {
  const list = tiers.value
  // not measured yet (or on the server): the widest
  if (!gridWidth.value) return list[0]!
  return list.find((t) => gridWidth.value >= t.min) ?? list.at(-1)!
})
/** The widest breakpoint: the one `v-model` holds. */
const isMain = computed(() => tier.value === tiers.value[0])
const optionsOf = (t: Tier): GridLayoutOptions => ({
  columns: Math.max(1, Math.round(t.columns)),
  compact: props.compact,
})
const options = computed(() => optionsOf(tier.value))
const mainLayout = computed(() => normalizeLayout(model.value, optionsOf(tiers.value[0]!)))
const settledRaw = computed<readonly GridItem[]>(() => {
  if (isMain.value) return mainLayout.value
  const main = mainLayout.value
  const derived = deriveLayout(main, optionsOf(tiers.value[0]!).columns, options.value)
  const saved = layouts.value[tier.value.name]
  if (!saved?.length) return derived
  const places = new Map(saved.map((place) => [place.id, place]))
  return normalizeLayout(
    main.map((item, i) => {
      const place = places.get(item.id)
      return place ? { ...item, x: place.x, y: place.y, w: place.w, h: place.h } : derived[i]!
    }),
    options.value,
  )
})
/**
 * The items drawn last time are reused where nothing about them changed, so
 * a change to one item draws only that one again, even when the layout had
 * to be worked out anew (e.g. from a document that wasn't compacted).
 */
let drawnById = new Map<string, GridItem>()
const ITEM_KEYS = ['x', 'y', 'w', 'h', 'minW', 'maxW', 'minH', 'maxH', 'locked'] as const
const settled = computed<readonly GridItem[]>(() => {
  const next = new Map<string, GridItem>()
  const list = settledRaw.value.map((item) => {
    const old = drawnById.get(item.id)
    const keep = old && ITEM_KEYS.every((key) => old[key] === item[key]) ? old : item
    next.set(item.id, keep)
    return keep
  })
  drawnById = next
  return list
})
watch(
  () => tier.value.name,
  (name, old) => old !== undefined && emit('breakpointChange', name),
)
/** The layout while a move or resize is under way; shown instead of `settled`. */
const preview = shallowRef<readonly GridItem[] | null>(null)
const layout = computed(() => preview.value ?? settled.value)
const gaps = computed<[number, number]>(() =>
  Array.isArray(props.gap) ? props.gap : [props.gap, props.gap],
)
const handles = computed<GridResizeHandle[]>(() => {
  const list: GridResizeHandle[] =
    props.resize === false ? [] : props.resize === true ? ['e', 's', 'se'] : props.resize
  // one column: only the height can change
  return options.value.columns === 1 ? list.filter((edge) => edge !== 'e') : list
})

interface Session {
  id: string
  kind: 'move' | 'resize' | 'drop'
  source: 'pointer' | 'keyboard'
  /** The layout when it started; pointer moves are always worked out from it. */
  base: readonly GridItem[]
  /** The item as it was. */
  item: GridItem
}

interface PointerSession extends Session {
  source: 'pointer'
  edge: GridResizeHandle | null
  el: HTMLElement
  startX: number
  startY: number
  scroller: Element | null
  scrollLeft: number
  scrollTop: number
  /** The scroller's box on screen, measured once. */
  view: { top: number; bottom: number }
  col: number
  colStep: number
  rowStep: number
  /** The item's box when it started, in px from the grid's corner. */
  left: number
  top: number
  width: number
  height: number
  /** The cell or size last worked out, so pointer moves within one cell do nothing. */
  cell: string
  /** For a drop: what `startDrop` was given. */
  drop?: { item: GridDropItem; data: unknown }
}

const session = shallowRef<Session | PointerSession | null>(null)
const settling = ref(false)
let settleTimer: ReturnType<typeof setTimeout> | undefined

const isPointer = (s: Session | null): s is PointerSession => s?.source === 'pointer'

/**
 * Items as drawn: the one under the pointer keeps its old place, and
 * follows the pointer from there; one being dropped in shows only as the
 * place it would take.
 */
const drawn = computed(() => {
  const s = session.value
  if (!isPointer(s)) return layout.value
  if (s.kind === 'drop') return layout.value.filter((item) => item.id !== s.id)
  return layout.value.map((item) => (item.id === s.id ? s.item : item))
})
/** Where the item under the pointer would land. */
const ghost = computed(() => {
  const s = session.value
  return isPointer(s) ? layout.value.find((item) => item.id === s.id) : undefined
})

function stateOf(id: string) {
  const s = session.value
  if (s?.id !== id) return 'idle'
  return s.kind === 'resize' ? 'resizing' : 'dragging'
}

const rootStyle = computed(() => ({
  '--dou-grid-columns': options.value.columns,
  '--dou-grid-row': `${props.rowHeight}px`,
  '--dou-grid-gap-x': `${gaps.value[0]}px`,
  '--dou-grid-gap-y': `${gaps.value[1]}px`,
  '--dou-grid-rows': layoutHeight(layout.value),
}))

const cellStyle = (item: GridItem) => ({
  '--dou-grid-x': item.x,
  '--dou-grid-y': item.y,
  '--dou-grid-w': item.w,
  '--dou-grid-h': item.h,
})

const labelOf = (item: GridItem) => props.itemLabel?.(item) ?? item.id
/** Where an item is, read out: its cell and size, or with one column its place in the list. */
function positionText(item: GridItem, items: readonly GridItem[]) {
  if (options.value.columns > 1)
    return format(messages.value.position, { x: item.x + 1, y: item.y + 1, w: item.w, h: item.h })
  let n = 1
  for (const other of items) if (other.y < item.y) n++
  return format(messages.value.order, { n, count: items.length })
}

// ---------------------------------------------------------------------------
// Announcements

const live = ref('')
function say(text: string) {
  // cleared first, so the same words twice are read twice
  live.value = ''
  requestAnimationFrame(() => (live.value = text))
}

// ---------------------------------------------------------------------------
// Focus: one item is in the tab order, the arrow keys move between them

const focusId = ref<string>()
const firstId = computed(() => {
  let first: GridItem | undefined
  for (const item of settled.value)
    if (!first || item.y < first.y || (item.y === first.y && item.x < first.x)) first = item
  return first?.id
})
const tabbableId = computed(() =>
  focusId.value && settled.value.some((item) => item.id === focusId.value)
    ? focusId.value
    : firstId.value,
)
const tabindexOf = (item: GridItem) =>
  props.editable ? (item.id === tabbableId.value ? 0 : -1) : undefined

function itemElement(id: string) {
  for (const child of root.value?.children ?? [])
    if (child instanceof HTMLElement && child.dataset.gridId === id) return child
  return undefined
}

/** The item element an event happened on: a direct child of this grid, not of a grid inside an item. */
function ownItem(target: EventTarget | null) {
  const el = target instanceof Element ? target.closest<HTMLElement>('[data-grid-id]') : null
  return el && el.parentElement === root.value ? el : null
}

function onFocusIn(event: FocusEvent) {
  const el = ownItem(event.target)
  if (el) focusId.value = el.dataset.gridId
}

/** The nearest item in the direction of an arrow key. */
function neighbour(from: GridItem, dx: number, dy: number) {
  const cx = from.x + from.w / 2
  const cy = from.y + from.h / 2
  let best: GridItem | undefined
  let bestScore = Infinity
  for (const item of settled.value) {
    if (item === from) continue
    const ix = item.x + item.w / 2 - cx
    const iy = item.y + item.h / 2 - cy
    const along = dx ? ix * dx : iy * dy
    if (along <= 0) continue
    const across = Math.abs(dx ? iy : ix)
    const score = along + across * 2
    if (score < bestScore) [best, bestScore] = [item, score]
  }
  return best
}

// ---------------------------------------------------------------------------
// Ending a move or resize

function commit(next: readonly GridItem[] | null, s: Session, reason: GridChangeReason) {
  if (!next || (next.length === s.base.length && next.every((item, i) => item === s.base[i])))
    return false
  const breakpoint = tier.value.name
  const drop = (s as PointerSession).drop
  let added: GridItem | undefined
  if (isMain.value) {
    const items = next.slice()
    added = drop && items.find((other) => other.id === s.id)
    model.value = items
    emit('change', { items, id: s.id, reason, breakpoint })
  } else {
    // a narrower breakpoint keeps its own places; a new item also joins the
    // widest layout, in the first spot there that fits its own size
    if (drop) {
      const main = mainLayout.value
      const wide = optionsOf(tiers.value[0]!)
      const fitted = fitItem({ ...drop.item, x: 0, y: 0 }, wide.columns)
      added = { ...fitted, ...findPlace(main, fitted, wide) }
      model.value = [...main, added]
    }
    layouts.value = {
      ...layouts.value,
      [breakpoint]: next.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    }
    emit('change', { items: next.slice(), id: s.id, reason, breakpoint })
  }
  if (drop && added) emit('drop', { item: added, data: drop.data, breakpoint })
  return true
}

function settle() {
  settling.value = true
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => (settling.value = false), SETTLE)
}

function finish(keep: boolean) {
  const s = session.value
  if (!s) return
  const next = preview.value
  if (isPointer(s)) stopPointer(s)
  session.value = null
  preview.value = null
  settle()
  const reason = s.source === 'keyboard' ? 'keyboard' : s.kind
  const changed = keep && commit(next, s, reason)
  emit('dragEnd', { id: s.id, kind: s.kind, cancelled: !keep || (s.kind === 'drop' && !changed) })
  // the keyboard hears every outcome; the pointer only a change, or a drag
  // undone (a new item that wasn't dropped has nowhere to go back to)
  if (s.source !== 'keyboard' && (keep || s.kind === 'drop') && !changed) return
  const items = (changed ? next : s.base) ?? s.base
  const item = items.find((other) => other.id === s.id) ?? s.item
  const label = labelOf(item)
  say(
    changed || (keep && s.source === 'keyboard')
      ? format(messages.value.dropped, { item: label, position: positionText(item, items) })
      : format(messages.value.cancelled, { item: label }),
  )
}

// ---------------------------------------------------------------------------
// Pointer

interface Press {
  event: PointerEvent
  el: HTMLElement
  id: string
  kind: 'move' | 'resize' | 'drop'
  edge: GridResizeHandle | null
  hold: PointerHold
  timer?: ReturnType<typeof setTimeout>
  /** For a drop: the new item and its data. */
  drop?: { item: GridDropItem; data: unknown }
}

let press: Press | null = null
let pointer = { x: 0, y: 0 }
let frame = 0

const NO_DRAG =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-dou-nodrag]'

function onPointerDown(event: PointerEvent) {
  if (!props.editable || session.value || press || !event.isPrimary) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const target = event.target as Element
  const el = ownItem(target)
  const id = el?.dataset.gridId
  const item = id === undefined ? undefined : settled.value.find((other) => other.id === id)
  if (!el || !id || !item || item.locked) return
  const handle = target.closest<HTMLElement>('[data-grid-resize]')
  let kind: Press['kind'] = 'move'
  let edge: GridResizeHandle | null = null
  if (handle && handle.parentElement === el) {
    kind = 'resize'
    edge = handle.dataset.gridResize as GridResizeHandle
  } else {
    if (props.handle) {
      const part = target.closest('[data-dou-grid-handle]')
      if (!part || part.closest('[data-grid-id]') !== el) return
    }
    if (target.closest(NO_DRAG)) return
  }
  listen({ event, el, id, kind, edge, hold: holdPointer(event, root.value) })
}

/** Follows a press until it becomes a drag (or a scroll, or nothing). */
function listen(next: Press) {
  const { event } = next
  press = next
  pointer = { x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  if (next.kind === 'resize') {
    // a handle does nothing else, so there is nothing to wait for
    event.preventDefault()
    begin()
  } else if (event.pointerType !== 'mouse') {
    next.timer = setTimeout(begin, HOLD_DELAY)
  }
}

function startDrop(event: PointerEvent, item: GridDropItem, data?: unknown) {
  if (!props.editable || session.value || press || !event.isPrimary || !root.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // an id already on the grid would replace that item
  if (settled.value.some((other) => other.id === item.id)) return
  listen({
    event,
    el: root.value,
    id: item.id,
    kind: 'drop',
    edge: null,
    hold: holdPointer(event, root.value),
    drop: { item, data },
  })
}

function onPointerMove(event: PointerEvent) {
  if (!press || event.pointerId !== press.event.pointerId) return
  pointer = { x: event.clientX, y: event.clientY }
  if (!session.value) {
    const distance = Math.hypot(pointer.x - press.event.clientX, pointer.y - press.event.clientY)
    if (press.event.pointerType === 'mouse') {
      if (distance >= DRAG_DISTANCE) begin()
    } else if (distance > HOLD_SLOP) {
      // the finger is scrolling the page
      dropPress()
    }
    return
  }
  track()
}

function onPointerUp(event: PointerEvent) {
  if (!press || event.pointerId !== press.event.pointerId) return
  if (session.value) finish(true)
  else dropPress()
}

function onPointerCancel(event: PointerEvent) {
  if (!press || event.pointerId !== press.event.pointerId) return
  if (session.value) finish(false)
  else dropPress()
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isPointer(session.value)) return
  event.preventDefault()
  event.stopPropagation()
  finish(false)
}

function onScroll() {
  if (isPointer(session.value)) track()
}

function dropPress() {
  if (!press) return
  clearTimeout(press.timer)
  press.hold.release()
  press = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function scrollParent(el: Element): Element | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight)
      return node
  }
  return null
}

const scrollOf = (scroller: Element | null) =>
  scroller
    ? { left: scroller.scrollLeft, top: scroller.scrollTop }
    : { left: window.scrollX, top: window.scrollY }

function begin() {
  const p = press
  const el = root.value
  if (!p || !el || session.value) return
  clearTimeout(p.timer)
  const item = p.drop
    ? fitItem({ ...p.drop.item, x: 0, y: 0 }, options.value.columns)
    : settled.value.find((other) => other.id === p.id)
  if (!item) return dropPress()
  const rect = el.getBoundingClientRect()
  const [gx, gy] = gaps.value
  const columns = options.value.columns
  const col = (rect.width - gx * (columns - 1)) / columns
  const scroller = scrollParent(el)
  const scroll = scrollOf(scroller)
  const box = scroller?.getBoundingClientRect()
  session.value = {
    id: p.id,
    kind: p.kind,
    source: 'pointer',
    edge: p.edge,
    base: settled.value,
    item,
    el: p.el,
    // a drop measures from the grid's corner, a move from where the press was
    startX: p.drop ? rect.left : p.event.clientX,
    startY: p.drop ? rect.top : p.event.clientY,
    scroller,
    scrollLeft: scroll.left,
    scrollTop: scroll.top,
    view: box ? { top: box.top, bottom: box.bottom } : { top: 0, bottom: window.innerHeight },
    col,
    colStep: col + gx,
    rowStep: props.rowHeight + gy,
    left: item.x * (col + gx),
    top: item.y * (props.rowHeight + gy),
    width: item.w * col + (item.w - 1) * gx,
    height: item.h * props.rowHeight + (item.h - 1) * gy,
    cell: '',
    drop: p.drop,
  }
  preview.value = settled.value
  p.hold.grab()
  if (p.event.pointerType === 'mouse') {
    try {
      // the grabbing cursor follows the pointer outside the grid
      el.setPointerCapture(p.event.pointerId)
    } catch {
      // the pointer is already gone
    }
  }
  window.addEventListener('keydown', onWindowKeydown, true)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  emit('dragStart', { id: p.id, kind: p.kind })
  frame = requestAnimationFrame(autoscroll)
  track()
}

function stopPointer(s: PointerSession) {
  cancelAnimationFrame(frame)
  for (const name of ['dx', 'dy', 'dw', 'dh']) s.el.style.removeProperty(`--dou-grid-${name}`)
  window.removeEventListener('keydown', onWindowKeydown, true)
  window.removeEventListener('scroll', onScroll, true)
  const touch = press?.event.pointerType !== 'mouse'
  dropPress()
  // the click that ends a drag isn't a click on whatever is under the pointer
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, true), touch ? 400 : 0)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** The length of `n` cells of `size` with `gap` between them. */
const span = (n: number, size: number, gap: number) => n * size + (n - 1) * gap
function swallow(event: Event) {
  event.stopPropagation()
  event.preventDefault()
}

/** Follows the pointer: moves the item with it, and works out the layout when it reaches another cell. */
function track() {
  const s = session.value
  if (!isPointer(s)) return
  const scroll = scrollOf(s.scroller)
  const dx = pointer.x - s.startX + scroll.left - s.scrollLeft
  const dy = pointer.y - s.startY + scroll.top - s.scrollTop
  const { columns } = options.value
  const [gx, gy] = gaps.value
  const item = s.item
  if (s.kind === 'drop') {
    // dx, dy: the pointer from the grid's corner; the item is held by its middle
    const height = layoutHeight(s.base) * s.rowStep
    const over =
      dx > -s.colStep / 2 &&
      dx < s.colStep * columns &&
      dy > -s.rowStep / 2 &&
      dy < height + s.rowStep * (item.h + 1)
    const x = clamp(Math.round((dx - s.width / 2) / s.colStep), 0, columns - item.w)
    const y = Math.max(0, Math.round((dy - s.height / 2) / s.rowStep))
    const cell = over ? `${x},${y}` : 'out'
    if (cell === s.cell) return
    s.cell = cell
    preview.value = over
      ? moveItem([...s.base, { ...item, x, y }], s.id, { x, y }, options.value)
      : s.base
    return
  }
  if (s.kind === 'move') {
    s.el.style.setProperty('--dou-grid-dx', `${dx}px`)
    s.el.style.setProperty('--dou-grid-dy', `${dy}px`)
    const x = clamp(Math.round((s.left + dx) / s.colStep), 0, columns - item.w)
    const y = Math.max(0, Math.round((s.top + dy) / s.rowStep))
    const cell = `${x},${y}`
    if (cell === s.cell) return
    s.cell = cell
    preview.value = moveItem(s.base, s.id, { x, y }, options.value)
    return
  }
  // resizing: the box follows the pointer within the item's limits, the size snaps to cells
  const maxW = Math.min(columns - item.x, item.maxW ?? Infinity)
  const minW = Math.min(maxW, Math.max(1, item.minW ?? 1))
  const maxH = item.maxH ?? Infinity
  const minH = Math.min(maxH, Math.max(1, item.minH ?? 1))
  const width =
    s.edge === 's' ? s.width : clamp(s.width + dx, span(minW, s.col, gx), span(maxW, s.col, gx))
  const height =
    s.edge === 'e'
      ? s.height
      : clamp(s.height + dy, span(minH, props.rowHeight, gy), span(maxH, props.rowHeight, gy))
  s.el.style.setProperty('--dou-grid-dw', `${width - s.width}px`)
  s.el.style.setProperty('--dou-grid-dh', `${height - s.height}px`)
  const w = Math.round((width + gx) / s.colStep)
  const h = Math.round((height + gy) / s.rowStep)
  const cell = `${w}x${h}`
  if (cell === s.cell) return
  s.cell = cell
  preview.value = resizeItem(s.base, s.id, { w, h }, options.value)
}

function autoscroll() {
  const s = session.value
  if (!isPointer(s)) return
  frame = requestAnimationFrame(autoscroll)
  const { top, bottom } = s.view
  let speed = 0
  if (pointer.y < top + EDGE) speed = -Math.min(1, (top + EDGE - pointer.y) / EDGE)
  else if (pointer.y > bottom - EDGE) speed = Math.min(1, (pointer.y - bottom + EDGE) / EDGE)
  if (!speed) return
  // the scroll event that follows moves the item along
  if (s.scroller) s.scroller.scrollTop += speed * EDGE_SPEED
  else window.scrollBy(0, speed * EDGE_SPEED)
}

// ---------------------------------------------------------------------------
// Keyboard

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function onKeyDown(event: KeyboardEvent) {
  if (!props.editable || event.target !== ownItem(event.target)) return
  const id = (event.target as HTMLElement).dataset.gridId!
  const s = session.value
  const arrow = ARROWS[event.key]
  if (s?.source === 'keyboard' && s.id === id) {
    if (arrow && !event.altKey && !event.metaKey && !event.ctrlKey) {
      const current = preview.value ?? s.base
      const next = event.shiftKey
        ? resizeItemBy(current, id, arrow[0], arrow[1], options.value)
        : moveItemBy(current, id, arrow[0], arrow[1], options.value)
      preview.value = next
      const item = next.find((other) => other.id === id)
      if (item) say(positionText(item, next))
    } else if (event.key === 'Enter' || event.key === ' ') {
      finish(true)
    } else if (event.key === 'Escape') {
      finish(false)
    } else if (event.key !== 'Tab') {
      return
    }
    if (event.key !== 'Tab') {
      event.preventDefault()
      event.stopPropagation()
    }
    return
  }
  if (s) return
  const item = settled.value.find((other) => other.id === id)
  if (!item) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (item.locked) return say(format(messages.value.locked, { item: labelOf(item) }))
    session.value = { id, kind: 'move', source: 'keyboard', base: settled.value, item }
    preview.value = settled.value
    emit('dragStart', { id, kind: 'move' })
    say(
      format(messages.value.grabbed, {
        item: labelOf(item),
        position: positionText(item, settled.value),
      }),
    )
  } else if (arrow && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
    const next = neighbour(item, arrow[0], arrow[1])
    if (!next) return
    event.preventDefault()
    itemElement(next.id)?.focus()
  }
}

/** Leaving a picked-up item puts it back. */
function onFocusOut(event: FocusEvent) {
  const s = session.value
  if (s?.source !== 'keyboard') return
  const el = ownItem(event.target)
  if (el?.dataset.gridId === s.id && !el.contains(event.relatedTarget as Node | null)) finish(false)
}

// ---------------------------------------------------------------------------

watch(
  () => props.editable,
  (editable) => {
    if (!editable) {
      finish(false)
      dropPress()
    }
  },
)

onBeforeUnmount(() => {
  finish(false)
  dropPress()
  clearTimeout(settleTimer)
})

defineExpose<GridLayoutExpose>({
  startDrop,
  get breakpoint() {
    return tier.value.name
  },
  focusItem(id) {
    const el = itemElement(id)
    if (!el) return
    if (props.editable) el.focus()
    else
      el.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )?.focus()
  },
  scrollToItem(id, scrollOptions) {
    itemElement(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest', ...scrollOptions })
  },
})
</script>

<template>
  <div
    ref="root"
    class="dou-grid-layout"
    :class="{
      'is-editable': editable,
      'has-handle': handle,
      'is-arranging': !!session || settling,
      'is-pointer-dragging': session?.source === 'pointer',
      'is-resizing': session?.kind === 'resize' && session.source === 'pointer',
    }"
    :style="rootStyle"
    :role="editable ? 'group' : undefined"
    :aria-label="label ?? (editable ? messages.layout : undefined)"
    @pointerdown="onPointerDown"
    @keydown="onKeyDown"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div
      v-if="ghost"
      class="dou-grid-layout__placeholder"
      :style="cellStyle(ghost)"
      aria-hidden="true"
    >
      <slot name="placeholder" :item="ghost" />
    </div>
    <GridItemView
      v-for="item in drawn"
      :key="item.id"
      :item="item"
      :state="stateOf(item.id)"
      :editable="editable"
      :tabindex="tabindexOf(item)"
      :label="labelOf(item)"
      :role-description="messages.item"
      :handles="handles"
    />
    <span v-if="editable" :id="hintId" hidden>{{ messages.itemHint }}</span>
    <div v-if="editable" class="dou-grid-layout__live" aria-live="assertive" aria-atomic="true">
      {{ live }}
    </div>
  </div>
</template>
