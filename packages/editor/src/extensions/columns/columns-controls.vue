<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { findBlockById } from '../../core/blocks'
import { useEditor } from '../../editor'
import { widthOf } from './schema'

/**
 * The bar between two columns: it shows when the pointer is in the middle
 * of the gap between them. Dragging it moves width from one column to the
 * other, a double click makes all the columns of the set even. The widths
 * are only written to the document when the drag ends: one undo step.
 */
const { view, root, messages, dragging } = useEditor()

const GROUP = '.dou-editor__content--columns + .dou-editor__group'
/** How far from the middle of the gap the bar can be grabbed. */
const REACH = 5
/** The narrowest a column gets by resizing. */
const MIN_WIDTH = 96

interface Bar {
  /** The set of columns, by id, and the column left of the bar. */
  row: string
  index: number
  top: number
  left: number
  height: number
}

const bar = shallowRef<Bar | null>(null)
const active = shallowRef(false)

const columnsOf = (group: Element) =>
  Array.from(group.children).filter((child): child is HTMLElement =>
    child.classList.contains('dou-editor__block'),
  )

/** Columns side by side (not stacked on a narrow screen). */
const sideBySide = (columns: HTMLElement[]) =>
  columns.length > 1 &&
  Math.abs(columns[0]!.getBoundingClientRect().top - columns[1]!.getBoundingClientRect().top) < 1

function place(group: HTMLElement, index: number) {
  const host = root.value
  const columns = columnsOf(group)
  const id = (group.parentElement as HTMLElement | null)?.dataset.blockId
  if (!host || !id || !columns[index + 1]) return
  const box = host.getBoundingClientRect()
  const rect = group.getBoundingClientRect()
  const middle =
    (columns[index]!.getBoundingClientRect().right +
      columns[index + 1]!.getBoundingClientRect().left) /
    2
  bar.value = {
    row: id,
    index,
    top: rect.top - box.top,
    left: middle - box.left,
    height: rect.height,
  }
}

function track(event: PointerEvent) {
  if (event.pointerType === 'touch' || resize || dragging.value) return
  const target = event.target as Element
  if (target.closest('.dou-editor-columns__bar')) return
  const group = target.closest<HTMLElement>(GROUP)
  const columns = group ? columnsOf(group) : []
  if (!group || !sideBySide(columns)) return (bar.value = null)
  for (let index = 0; index < columns.length - 1; index++) {
    const middle =
      (columns[index]!.getBoundingClientRect().right +
        columns[index + 1]!.getBoundingClientRect().left) /
      2
    if (Math.abs(event.clientX - middle) <= REACH) return place(group, index)
  }
  bar.value = null
}

function leave() {
  if (!resize) bar.value = null
}

/** The column blocks of a set: where each content node is, and its width. */
function columnsInDoc(row: string) {
  const current = view.value
  const info = current && findBlockById(current.state.doc, row)
  if (!info?.group) return null
  const list: { contentPos: number; width: number }[] = []
  let pos = info.contentPos + info.content.nodeSize + 1
  info.group.forEach((column) => {
    list.push({ contentPos: pos + 1, width: widthOf(column.firstChild!.attrs.width) ?? 1 })
    pos += column.nodeSize
  })
  return list
}

let resize: {
  pointer: number
  group: HTMLElement
  left: HTMLElement
  right: HTMLElement
  /** The two columns' left edge, and their widths together, in pixels. */
  start: number
  span: number
  gap: number
  /** Their weights together, shared out again. */
  total: number
  weights: [number, number]
} | null = null

function onDown(event: PointerEvent) {
  const current = bar.value
  const group = current && findGroup(current.row)
  const columns = group ? columnsOf(group) : []
  const weights = current && columnsInDoc(current.row)
  if (event.button !== 0 || !current || !group || !weights) return
  const left = columns[current.index]
  const right = columns[current.index + 1]
  if (!left || !right) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const a = left.getBoundingClientRect()
  const b = right.getBoundingClientRect()
  const total = weights[current.index]!.width + weights[current.index + 1]!.width
  resize = {
    pointer: event.pointerId,
    group,
    left,
    right,
    start: a.left,
    span: a.width + b.width,
    gap: b.left - a.right,
    total,
    weights: [weights[current.index]!.width, weights[current.index + 1]!.width],
  }
  active.value = true
}

function onMove(event: PointerEvent) {
  if (!resize || event.pointerId !== resize.pointer) return
  const { start, span, gap, total } = resize
  const min = Math.min(MIN_WIDTH, span / 2)
  const width = Math.min(span - min, Math.max(min, event.clientX - gap / 2 - start))
  const share = Math.round((total * width * 1000) / span) / 1000
  resize.weights = [share, Math.round((total - share) * 1000) / 1000]
  resize.left.style.setProperty('--dou-editor-column-width', String(resize.weights[0]))
  resize.right.style.setProperty('--dou-editor-column-width', String(resize.weights[1]))
  const current = bar.value
  if (current) place(resize.group, current.index)
}

function onUp(event: PointerEvent) {
  if (!resize || event.pointerId !== resize.pointer) return
  const { weights } = resize
  const current = bar.value
  resize = null
  active.value = false
  const columns = current && columnsInDoc(current.row)
  const instance = view.value
  if (!current || !columns || !instance) return
  const tr = instance.state.tr
  weights.forEach((weight, offset) => {
    const column = columns[current.index + offset]!
    tr.setNodeAttribute(column.contentPos, 'width', weight === 1 ? null : widthOf(weight))
  })
  instance.dispatch(tr)
}

/** A double click: every column of the set as wide as the others. */
function even() {
  const current = bar.value
  const columns = current && columnsInDoc(current.row)
  const instance = view.value
  if (!columns || !instance) return
  const tr = instance.state.tr
  for (const column of columns) {
    if (column.width !== 1) tr.setNodeAttribute(column.contentPos, 'width', null)
  }
  if (tr.docChanged) instance.dispatch(tr)
}

function findGroup(row: string) {
  const block = view.value?.dom.querySelector(`[data-block-id="${CSS.escape(row)}"]`)
  return block?.querySelector<HTMLElement>(`:scope > ${GROUP}`)
}

const onScroll = () => {
  if (!resize) bar.value = null
}

onMounted(() => {
  root.value?.addEventListener('pointermove', track)
  root.value?.addEventListener('pointerleave', leave)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  root.value?.removeEventListener('pointermove', track)
  root.value?.removeEventListener('pointerleave', leave)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div
    v-if="bar"
    :class="['dou-editor-columns__bar', { 'is-active': active }]"
    role="separator"
    aria-orientation="vertical"
    :aria-label="messages.columns.resize"
    :title="messages.columns.resize"
    :style="{ top: `${bar.top}px`, left: `${bar.left}px`, height: `${bar.height}px` }"
    @mousedown.prevent
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="even"
  />
</template>
