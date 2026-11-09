<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { findBlockById, layoutOf, parentBlock, blockAround } from '../../core/blocks'
import { childBlocks, COLUMNS_GROUP, sideBySide } from '../../dom'
import { useEditor } from '../../editor'
import { previewColumns, refreshColumns, type ColumnPreview } from './plugin'
import { widthOf } from './schema'

/**
 * The bars between columns. One shows when the pointer is in the middle of
 * the gap between two columns (on a touch screen, after a tap there);
 * dragging it moves width from one column to the other, `Esc` takes the
 * drag back, a double click makes all the columns of the set even. While
 * the cursor is in a set of columns, its bars can also be reached with
 * `Tab` and moved with `←` `→`. A drag is shown as it goes and written to
 * the document when it ends: one undo step.
 */
const { view, state, root, messages, dragging } = useEditor()

/** How far from the middle of the gap the bar can be grabbed, and on a touch screen tapped. */
const REACH = 5
const TOUCH_REACH = 20
/** The narrowest a column gets by resizing. */
const MIN_WIDTH = 96
/** How much of the two columns' width a key press moves. */
const STEP = 0.05

interface Bar {
  /** The set of columns, by id, and the column left of the bar. */
  row: string
  index: number
  top: number
  left: number
  height: number
  /** The left column's share of the two, in percent, for screen readers. */
  value: number
}

/** The bar under the pointer. */
const bar = shallowRef<Bar | null>(null)
/** The bars of the set of columns the cursor is in, for the keyboard. */
const keyBars = shallowRef<Bar[]>([])
const active = shallowRef(false)

/** The column blocks of a set: where each block is, and its width. */
function columnsInDoc(row: string) {
  const current = view.value
  const info = current && findBlockById(current.state.doc, row)
  if (!info?.group || layoutOf(info.node) !== 'row') return null
  const list: { pos: number; width: number }[] = []
  let pos = info.contentPos + info.content.nodeSize + 1
  info.group.forEach((column) => {
    list.push({ pos, width: widthOf(column.firstChild!.attrs.width) ?? 1 })
    pos += column.nodeSize
  })
  return list
}

function findGroup(row: string) {
  const block = view.value?.dom.querySelector(`[data-block-id="${CSS.escape(row)}"]`)
  return block?.querySelector<HTMLElement>(`:scope > ${COLUMNS_GROUP}`) ?? null
}

/** The middle of the gap after column `index`, on the screen. */
const middleOf = (columns: HTMLElement[], index: number) =>
  (columns[index]!.getBoundingClientRect().right +
    columns[index + 1]!.getBoundingClientRect().left) /
  2

function barAt(group: HTMLElement, index: number): Bar | null {
  const host = root.value
  const columns = childBlocks(group)
  const id = (group.parentElement as HTMLElement | null)?.dataset.blockId
  const weights = id && columnsInDoc(id)
  if (!host || !id || !weights || !columns[index + 1]) return null
  const box = host.getBoundingClientRect()
  const rect = group.getBoundingClientRect()
  const left = weights[index]!.width
  const right = weights[index + 1]!.width
  return {
    row: id,
    index,
    top: rect.top - box.top,
    left: middleOf(columns, index) - box.left,
    height: rect.height,
    value: Math.round((left / (left + right)) * 100),
  }
}

/** The bar near `x` in the set of columns `target` is in, if any. */
function barNear(target: Element, x: number, reach: number): Bar | null {
  const group = target.closest<HTMLElement>(COLUMNS_GROUP)
  const columns = group ? childBlocks(group) : []
  if (!group || !sideBySide(columns)) return null
  for (let index = 0; index < columns.length - 1; index++)
    if (Math.abs(x - middleOf(columns, index)) <= reach) return barAt(group, index)
  return null
}

function track(event: PointerEvent) {
  if (event.pointerType === 'touch' || resize || dragging.value) return
  const target = event.target as Element
  if (target.closest('.dou-editor-columns__bar')) return
  bar.value = barNear(target, event.clientX, REACH)
}

/** A tap in the middle of a gap shows the bar there, to drag next. */
function tap(event: PointerEvent) {
  if (event.pointerType === 'mouse' || resize) return
  const target = event.target as Element
  if (target.closest('.dou-editor-columns__bar')) return
  bar.value = barNear(target, event.clientX, TOUCH_REACH)
}

function leave(event: PointerEvent) {
  if (!resize && event.pointerType === 'mouse') bar.value = null
}

/** The bars of the set of columns around the cursor. */
function placeKeyBars() {
  const current = state.value
  const block = current && blockAround(current.selection.$from)
  let row = block && parentBlock(current.doc, block)
  while (row && layoutOf(row.node) !== 'row') row = parentBlock(current!.doc, row)
  const group = row && findGroup(row.node.attrs.id as string)
  const columns = group ? childBlocks(group) : []
  if (!group || !sideBySide(columns)) {
    keyBars.value = []
    return
  }
  keyBars.value = columns
    .slice(1)
    .map((_, index) => barAt(group, index))
    .filter((entry): entry is Bar => !!entry)
}

watch(state, () => void nextTick(placeKeyBars), { flush: 'post' })
// the columns' names follow the locale
watch(messages, () => {
  const current = view.value
  if (current) current.dispatch(refreshColumns(current.state.tr))
})

/* dragging */

let resize: {
  pointer: number
  bar: Bar
  /** The two columns' widths together, in pixels, and the gap between them. */
  start: number
  span: number
  gap: number
  /** Their weights together, shared out again. */
  total: number
  /** Where the two columns are in the document. */
  columns: [number, number]
  weights: [number, number]
} | null = null

/** The two columns beside a bar: where they are, their weights and their size on the screen. */
function pairOf(current: Bar) {
  const group = findGroup(current.row)
  const columns = group ? childBlocks(group) : []
  const weights = columnsInDoc(current.row)
  const left = columns[current.index]
  const right = columns[current.index + 1]
  const a = weights?.[current.index]
  const b = weights?.[current.index + 1]
  if (!group || !left || !right || !a || !b) return null
  const first = left.getBoundingClientRect()
  const second = right.getBoundingClientRect()
  return {
    group,
    start: first.left,
    span: first.width + second.width,
    gap: second.left - first.right,
    columns: [a.pos, b.pos] as [number, number],
    weights: [a.width, b.width] as [number, number],
  }
}

/** The left column's weight for a width in pixels, the narrowest kept. */
function share(total: number, span: number, width: number): [number, number] {
  const min = Math.min(MIN_WIDTH, span / 2)
  const clamped = Math.min(span - min, Math.max(min, width))
  const left = Math.round((total * clamped * 1000) / span) / 1000
  return [left, Math.round((total - left) * 1000) / 1000]
}

function show(preview: ColumnPreview[] | null) {
  const current = view.value
  if (current) current.dispatch(previewColumns(current.state.tr, preview))
}

/** Write the two columns' widths: one undo step. */
function commit(columns: [number, number], weights: [number, number]) {
  const current = view.value
  if (!current) return
  const tr = previewColumns(current.state.tr, null).setMeta('addToHistory', true)
  columns.forEach((pos, offset) => {
    const weight = weights[offset]!
    tr.setNodeAttribute(pos + 1, 'width', weight === 1 ? null : widthOf(weight))
  })
  current.dispatch(tr)
}

function onDown(event: PointerEvent, current: Bar) {
  if (event.button !== 0) return
  const pair = pairOf(current)
  if (!pair) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  resize = {
    pointer: event.pointerId,
    bar: current,
    start: pair.start,
    span: pair.span,
    gap: pair.gap,
    total: pair.weights[0] + pair.weights[1],
    columns: pair.columns,
    weights: pair.weights,
  }
  active.value = true
  window.addEventListener('keydown', onEscape, true)
}

function onMove(event: PointerEvent) {
  if (!resize || event.pointerId !== resize.pointer) return
  const { start, span, gap, total, columns } = resize
  resize.weights = share(total, span, event.clientX - gap / 2 - start)
  show(columns.map((pos, offset) => ({ pos, width: resize!.weights[offset]! })))
  const group = findGroup(resize.bar.row)
  const moved = group && barAt(group, resize.bar.index)
  if (moved) bar.value = moved
}

function end() {
  resize = null
  active.value = false
  window.removeEventListener('keydown', onEscape, true)
}

function onUp(event: PointerEvent) {
  if (!resize || event.pointerId !== resize.pointer) return
  const { columns, weights } = resize
  end()
  commit(columns, weights)
}

/** `Esc` or a cancelled pointer: the widths as they were. */
function cancel() {
  if (!resize) return
  end()
  show(null)
  const current = bar.value
  const group = current && findGroup(current.row)
  if (current && group) bar.value = barAt(group, current.index)
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  cancel()
}

/** `←` `→` on a bar: move a little width from one column to the other; `Esc` or `Shift+Tab` back to the text. */
function onKey(event: KeyboardEvent, current: Bar) {
  if (event.key === 'Escape' || (event.key === 'Tab' && event.shiftKey)) {
    event.preventDefault()
    view.value?.focus()
    return
  }
  const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
  if (!direction) return
  event.preventDefault()
  const pair = pairOf(current)
  if (!pair) return
  const total = pair.weights[0] + pair.weights[1]
  const width = (pair.weights[0] / total) * pair.span + direction * STEP * pair.span
  commit(pair.columns, share(total, pair.span, width))
  void nextTick(placeKeyBars)
}

/** A double click: every column of the set as wide as the others. */
function even(current: Bar) {
  const columns = columnsInDoc(current.row)
  const instance = view.value
  if (!columns || !instance) return
  const tr = instance.state.tr
  for (const column of columns)
    if (column.width !== 1) tr.setNodeAttribute(column.pos + 1, 'width', null)
  if (tr.docChanged) instance.dispatch(tr)
}

/** The bars to draw: the keyboard's, and the pointer's when it is at another gap. */
const bars = computed(() => {
  const list = keyBars.value.map((entry) => ({ ...entry, key: true, shown: false }))
  const pointed = bar.value
  if (!pointed) return list
  const same = list.findIndex((entry) => entry.row === pointed.row && entry.index === pointed.index)
  if (same < 0) return [...list, { ...pointed, key: false, shown: true }]
  list[same] = { ...pointed, key: true, shown: true }
  return list
})

const onScroll = () => {
  if (!resize) bar.value = null
}

// the editor narrower or wider (a window resized, a tablet turned): the bars move with the columns
let observer: ResizeObserver | undefined

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => {
      if (!resize) bar.value = null
      placeKeyBars()
    })
    observer.observe(root.value)
  }
  root.value?.addEventListener('pointermove', track)
  root.value?.addEventListener('pointerdown', tap)
  root.value?.addEventListener('pointerleave', leave)
  window.addEventListener('scroll', onScroll, true)
  placeKeyBars()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  root.value?.removeEventListener('pointermove', track)
  root.value?.removeEventListener('pointerdown', tap)
  root.value?.removeEventListener('pointerleave', leave)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('keydown', onEscape, true)
})
</script>

<template>
  <div
    v-for="entry in bars"
    :key="`${entry.row}-${entry.index}`"
    :class="[
      'dou-editor-columns__bar',
      { 'is-key': entry.key, 'is-shown': entry.shown, 'is-active': active && entry.shown },
    ]"
    role="separator"
    aria-orientation="vertical"
    :tabindex="entry.key ? 0 : -1"
    :aria-label="messages.columns.resize"
    :aria-valuenow="entry.value"
    aria-valuemin="0"
    aria-valuemax="100"
    :title="messages.columns.resize"
    :style="{ top: `${entry.top}px`, left: `${entry.left}px`, height: `${entry.height}px` }"
    @mousedown.prevent
    @pointerdown="onDown($event, entry)"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="cancel"
    @lostpointercapture="cancel"
    @keydown="onKey($event, entry)"
    @focus="placeKeyBars"
    @dblclick="even(entry)"
  />
</template>
