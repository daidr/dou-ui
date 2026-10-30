<script setup lang="ts">
import {
  ArrowDownFromLineIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowLeftToLineIcon,
  ArrowRightIcon,
  ArrowRightToLineIcon,
  ArrowUpIcon,
  ArrowUpToLineIcon,
  CheckIcon,
  EraserIcon,
  GripHorizontalIcon,
  GripVerticalIcon,
  LayoutColumnsIcon,
  LayoutRowsIcon,
  MergeIcon,
  PlusIcon,
  SplitIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TrashIcon,
} from '@dou-ui/icons'
import { DouDropdown, DouDropdownItem, DouDropdownSub } from 'dou-ui'
import { TextSelection, type Command } from 'prosemirror-state'
import { CellSelection, TableMap, addColumn, addRow, type Rect } from 'prosemirror-tables'
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { createId } from '../../core/model'
import { useEditorContext } from '../../editor'
import {
  alignColumns,
  band,
  boundaries,
  clearCells,
  deleteColumns,
  deleteRows,
  inMergedCell,
  insertColumn,
  insertRow,
  mergeCells,
  moveLines,
  moveLinesTo,
  selectLines,
  splitMergedCell,
  tableAt,
  toggleHeader,
} from './commands'
import { fitColumns, type TableAlign } from './schema'

const { view, state, root, messages } = useEditorContext()

/** The table and the cell the controls are about: the hovered one, or the selection's. */
interface Target {
  /** Position right before the table node. */
  pos: number
  /** The cell's place in the grid. */
  rect: Rect
}

const hovered = shallowRef<Target | null>(null)
const columnMenu = shallowRef(false)
const rowMenu = shallowRef(false)
const menuOpen = computed(() => columnMenu.value || rowMenu.value)
// the cells toolbar stands in for the handles while cells are selected
const barShown = computed(() => !!layout.value?.bar && !menuOpen.value && !dragging.value)

function targetOf(cell: HTMLElement): Target | null {
  const current = view.value
  if (!current || !current.dom.contains(cell)) return null
  const $pos = current.state.doc.resolve(current.posAtDOM(cell, 0))
  const found = tableAt($pos)
  if (!found) return null
  // the cell node starts right before its content
  for (let depth = $pos.depth; depth > 0; depth--) {
    const role = $pos.node(depth).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') {
      const cellPos = $pos.before(depth) - found.pos - 1
      return { pos: found.pos, rect: found.map.findCell(cellPos) }
    }
  }
  return null
}

/** The selection's cell when the pointer is elsewhere. */
const selected = computed<Target | null>(() => {
  const current = state.value
  if (!current) return null
  const selection = current.selection
  const $cell = selection instanceof CellSelection ? selection.$headCell : null
  const found = tableAt(selection.$head)
  if (!found) return null
  const start = found.pos + 1
  if ($cell) return { pos: found.pos, rect: found.map.findCell($cell.pos - start) }
  for (let depth = selection.$head.depth; depth > 0; depth--) {
    const role = selection.$head.node(depth).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell')
      return { pos: found.pos, rect: found.map.findCell(selection.$head.before(depth) - start) }
  }
  return null
})

const target = computed(() => hovered.value ?? selected.value)

/* where things go */

interface Layout {
  /** The table, relative to the editor. */
  table: { top: number; left: number; width: number; height: number }
  /** The visible part of the table, when it scrolls sideways. */
  frame: { left: number; right: number }
  column: { left: number; width: number }
  row: { top: number; height: number }
  /** Where the cell toolbar goes (its top centre): over selected cells, or a merged cell with the cursor. */
  bar: { top: number; left: number } | null
}

const layout = shallowRef<Layout | null>(null)

function cellElement(tablePos: number, row: number, col: number): HTMLElement | null {
  const current = view.value
  const table = current?.state.doc.nodeAt(tablePos)
  if (!current || !table) return null
  const map = TableMap.get(table)
  if (row >= map.height || col >= map.width) return null
  const pos = tablePos + 1 + map.map[row * map.width + col]!
  return current.nodeDOM(pos) as HTMLElement | null
}

function measure() {
  const current = view.value
  const host = root.value
  const at = target.value
  if (!current || !host || !at) return (layout.value = null)
  const tableNode = current.state.doc.nodeAt(at.pos)
  const frameElement = current.nodeDOM(at.pos) as HTMLElement | null
  const tableElement = frameElement?.querySelector('table')
  if (!tableNode || !frameElement || !tableElement) return (layout.value = null)
  const box = host.getBoundingClientRect()
  const tableBox = tableElement.getBoundingClientRect()
  const frameBox = frameElement.getBoundingClientRect()
  const first = cellElement(at.pos, at.rect.top, at.rect.left)?.getBoundingClientRect()
  if (!first) return (layout.value = null)
  let bar: Layout['bar'] = null
  const boxes = barCells(current).map((pos) =>
    (current.nodeDOM(pos) as HTMLElement).getBoundingClientRect(),
  )
  if (boxes.length) {
    const left = Math.max(Math.min(...boxes.map((item) => item.left)), frameBox.left)
    const right = Math.min(Math.max(...boxes.map((item) => item.right)), frameBox.right)
    bar = {
      top: Math.min(...boxes.map((item) => item.top)) - box.top,
      left: (left + right) / 2 - box.left,
    }
  }
  layout.value = {
    table: {
      top: tableBox.top - box.top,
      left: tableBox.left - box.left,
      width: tableBox.width,
      height: tableBox.height,
    },
    frame: { left: frameBox.left - box.left, right: frameBox.right - box.left },
    column: { left: first.left - box.left, width: first.width },
    row: { top: first.top - box.top, height: first.height },
    bar,
  }
}

/** The cells the toolbar is about: a cell selection's corners, or the merged cell with the cursor. */
function barCells(current: NonNullable<typeof view.value>): number[] {
  const selection = current.state.selection
  if (selection instanceof CellSelection)
    return selection.$anchorCell.pos === selection.$headCell.pos
      ? []
      : [selection.$anchorCell.pos, selection.$headCell.pos]
  if (!inMergedCell(current.state)) return []
  const $head = selection.$head
  for (let depth = $head.depth; depth > 0; depth--) {
    const role = $head.node(depth).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return [$head.before(depth)]
  }
  return []
}

let frame = 0
let lastTarget: EventTarget | null = null

function schedule() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    if (!menuOpen.value && !dragging.value) {
      const element = lastTarget instanceof Element ? lastTarget : null
      const cell = element?.closest<HTMLElement>('.dou-editor-table td, .dou-editor-table th')
      const inControls = element?.closest('.dou-editor-table-controls')
      if (cell) hovered.value = targetOf(cell)
      else if (!inControls) hovered.value = null
    }
    measure()
  })
}

function track(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  lastTarget = event.target
  schedule()
}

function leave() {
  if (menuOpen.value || dragging.value) return
  lastTarget = null
  hovered.value = null
  schedule()
}

const onScroll = () => schedule()

onMounted(() => {
  root.value?.addEventListener('pointermove', track)
  root.value?.addEventListener('pointerleave', leave)
  // the table frame scrolls sideways; the page scrolls too
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  root.value?.removeEventListener('pointermove', track)
  root.value?.removeEventListener('pointerleave', leave)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
  if (frame) cancelAnimationFrame(frame)
  endDrag(false)
})

watch([state, target], () => schedule())

/* actions */

function run(command: Command) {
  const current = view.value
  if (!current) return
  command(current.state, current.dispatch)
  current.focus()
}

/** Select the target's columns (or rows), whole runs with merged cells. */
function selectTarget(axis: 'row' | 'column') {
  const current = view.value
  const at = target.value
  if (!current || !at) return
  const table = current.state.doc.nodeAt(at.pos)!
  const map = TableMap.get(table)
  const [from, to] = axis === 'row' ? [at.rect.top, at.rect.bottom] : [at.rect.left, at.rect.right]
  const lines = band(map, axis, from, to)
  current.dispatch(selectLines(current.state.tr, at.pos, axis, lines.start, lines.end))
}

function openMenu(axis: 'row' | 'column') {
  // the click that ends a drag
  if (dragged) return
  selectTarget(axis)
  if (axis === 'row') rowMenu.value = true
  else columnMenu.value = true
}

/**
 * Whole lines are selected to show what a menu or a drag is about; after
 * it, the cursor goes into their first cell so the handles come back.
 */
function collapseLines() {
  const current = view.value
  const selection = current?.state.selection
  if (!current || !(selection instanceof CellSelection)) return
  if (!selection.isRowSelection() && !selection.isColSelection()) return
  const $cell = current.state.doc.resolve(selection.$anchorCell.pos + 1)
  current.dispatch(current.state.tr.setSelection(TextSelection.near($cell)))
}

watch(menuOpen, (open) => {
  if (open) return
  collapseLines()
  schedule()
})

const can = (command: Command) => {
  const current = state.value
  return !!current && command(current)
}

const tableNode = computed(() => {
  const at = target.value
  return at ? (state.value?.doc.nodeAt(at.pos) ?? null) : null
})

const columnAlign = computed<TableAlign>(() => {
  const node = tableNode.value
  const at = target.value
  if (!node || !at) return 'left'
  return (fitColumns(node.attrs.columns, TableMap.get(node).width)[at.rect.left]?.align ??
    'left') as TableAlign
})

const aligns: { value: TableAlign; icon: unknown; label: () => string }[] = [
  { value: 'left', icon: TextAlignLeftIcon, label: () => messages.value.table.alignLeft },
  { value: 'center', icon: TextAlignCenterIcon, label: () => messages.value.table.alignCenter },
  { value: 'right', icon: TextAlignRightIcon, label: () => messages.value.table.alignRight },
]

/** The + bars: a column at the right end, a row at the bottom. */
function addAtEnd(axis: 'row' | 'column') {
  const current = view.value
  const at = target.value
  if (!current || !at) return
  const table = current.state.doc.nodeAt(at.pos)!
  const map = TableMap.get(table)
  const rect = {
    left: 0,
    top: 0,
    right: map.width,
    bottom: map.height,
    map,
    table,
    tableStart: at.pos + 1,
  }
  let tr = current.state.tr
  if (axis === 'row') tr = addRow(tr, rect, map.height)
  else {
    const columns = fitColumns(table.attrs.columns, map.width)
    columns.push({ id: createId() })
    tr = addColumn(tr, rect, map.width).setNodeAttribute(at.pos, 'columns', columns)
  }
  current.dispatch(tr)
}

/* dragging rows and columns by their handle */

interface Drag {
  axis: 'row' | 'column'
  tablePos: number
  /** The lines that move: the target's, with any merged cells they belong to. */
  start: number
  end: number
  x: number
  y: number
  /** Where they go: the line they go before, or `null` for where they are. */
  to: number | null
}

let drag: Drag | null = null
let dragged = false
const dragging = shallowRef(false)
const drop = shallowRef<{ axis: 'row' | 'column'; at: number } | null>(null)
/** A copy of the dragged lines that follows the pointer. */
let ghost: HTMLElement | null = null

function onHandleDown(axis: 'row' | 'column', event: PointerEvent) {
  const current = view.value
  const at = target.value
  if (event.button !== 0 || !current || !at || !current.editable) return
  const map = TableMap.get(current.state.doc.nodeAt(at.pos)!)
  const [from, to] = axis === 'row' ? [at.rect.top, at.rect.bottom] : [at.rect.left, at.rect.right]
  const lines = band(map, axis, from, to)
  drag = { axis, tablePos: at.pos, ...lines, x: event.clientX, y: event.clientY, to: null }
  dragged = false
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
  window.addEventListener('pointercancel', onDragCancel)
}

/** Each boundary a run can go to, and where it is (relative to the editor). */
function cutPlaces(moving: Drag): { cut: number; at: number }[] {
  const current = view.value
  const host = root.value
  const table = current?.state.doc.nodeAt(moving.tablePos)
  const element = (current?.nodeDOM(moving.tablePos) as HTMLElement | null)?.querySelector('table')
  if (!current || !host || !table || !element) return []
  const box = host.getBoundingClientRect()
  const tableBox = element.getBoundingClientRect()
  const map = TableMap.get(table)
  const places: { cut: number; at: number }[] = []
  if (moving.axis === 'row') {
    const tops: number[] = []
    table.forEach((_row, offset) => {
      const row = current.nodeDOM(moving.tablePos + 1 + offset) as HTMLElement | null
      tops.push((row?.getBoundingClientRect().top ?? tableBox.top) - box.top)
    })
    for (const cut of boundaries(map, 'row'))
      places.push({ cut, at: cut < map.height ? tops[cut]! : tableBox.bottom - box.top })
    return places
  }
  for (const cut of boundaries(map, 'column')) {
    if (cut === map.width) {
      places.push({ cut, at: tableBox.right - box.left })
      continue
    }
    // no merged cell crosses a boundary, so the first row has a cell starting there
    let row = 0
    while (row < map.height && map.findCell(map.map[row * map.width + cut]!).left !== cut) row++
    const cell = cellElement(moving.tablePos, row, cut)
    if (cell) places.push({ cut, at: cell.getBoundingClientRect().left - box.left })
  }
  return places
}

function showGhost(moving: Drag) {
  const current = view.value
  const host = root.value
  const table = current?.state.doc.nodeAt(moving.tablePos)
  const element = (current?.nodeDOM(moving.tablePos) as HTMLElement | null)?.querySelector('table')
  if (!current || !host || !table || !element) return
  const map = TableMap.get(table)
  const copy = document.createElement('table')
  copy.className = 'dou-editor-table'
  const body = document.createElement('tbody')
  copy.append(body)
  let width = 0
  const [rows, cols] =
    moving.axis === 'row'
      ? [
          [moving.start, moving.end],
          [0, map.width],
        ]
      : [
          [0, map.height],
          [moving.start, moving.end],
        ]
  for (let row = rows[0]!; row < rows[1]!; row++) {
    const line = document.createElement('tr')
    let lineWidth = 0
    for (let col = cols[0]!; col < cols[1]!; col++) {
      const rect = map.findCell(map.map[row * map.width + col]!)
      if (rect.top !== row || rect.left !== col) continue
      const cell = cellElement(moving.tablePos, row, col)
      if (!cell) continue
      const clone = cell.cloneNode(true) as HTMLElement
      clone.classList.remove('selectedCell')
      clone.style.width = `${cell.getBoundingClientRect().width}px`
      lineWidth += cell.getBoundingClientRect().width
      line.append(clone)
    }
    width = Math.max(width, lineWidth)
    body.append(line)
  }
  ghost = document.createElement('div')
  ghost.className = 'dou-editor__surface dou-editor__ghost dou-editor-table__ghost'
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.width = `${Math.min(width, 360) + 2}px`
  ghost.append(copy)
  host.append(ghost)
}

function onDragMove(event: PointerEvent) {
  const moving = drag
  if (!moving) return
  if (!dragging.value) {
    if (Math.hypot(event.clientX - moving.x, event.clientY - moving.y) < 4) return
    dragging.value = true
    dragged = true
    columnMenu.value = false
    rowMenu.value = false
    const current = view.value
    if (current)
      current.dispatch(
        selectLines(current.state.tr, moving.tablePos, moving.axis, moving.start, moving.end),
      )
    showGhost(moving)
  }
  if (ghost) ghost.style.transform = `translate(${event.clientX + 12}px, ${event.clientY + 12}px)`
  const host = root.value
  if (!host) return
  const box = host.getBoundingClientRect()
  const pointer = moving.axis === 'row' ? event.clientY - box.top : event.clientX - box.left
  let best: { cut: number; at: number } | null = null
  for (const place of cutPlaces(moving))
    if (!best || Math.abs(place.at - pointer) < Math.abs(best.at - pointer)) best = place
  // a boundary of the run itself leaves it where it is
  if (!best || (best.cut >= moving.start && best.cut <= moving.end)) {
    moving.to = null
    drop.value = null
    return
  }
  moving.to = best.cut
  drop.value = { axis: moving.axis, at: best.at }
}

function onDragUp() {
  endDrag(true)
}

function onDragCancel() {
  endDrag(false)
}

function endDrag(apply: boolean) {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  window.removeEventListener('pointercancel', onDragCancel)
  const moving = drag
  drag = null
  ghost?.remove()
  ghost = null
  drop.value = null
  if (!dragging.value) return
  dragging.value = false
  // the click that follows the drag isn't a click
  setTimeout(() => (dragged = false))
  if (apply && moving?.to !== null && moving)
    run(moveLinesTo(moving.tablePos, moving.axis, moving.start, moving.end, moving.to))
  collapseLines()
  schedule()
}

const hasCellSelection = computed(() => {
  const selection = state.value?.selection
  return selection instanceof CellSelection && selection.$anchorCell.pos !== selection.$headCell.pos
})

const visible = computed(() => !!layout.value && !!target.value)
</script>

<template>
  <div v-if="visible && layout" class="dou-editor-table-controls" @mousedown.prevent>
    <!-- column handle, above the column -->
    <DouDropdown
      v-model:open="columnMenu"
      trigger="manual"
      placement="bottom-start"
      class="dou-editor-menu"
    >
      <button
        type="button"
        tabindex="-1"
        v-show="!barShown"
        class="dou-editor-table__handle is-column"
        :class="{ 'is-active': columnMenu }"
        :style="{
          top: `${layout.table.top}px`,
          left: `${Math.min(Math.max(layout.column.left + layout.column.width / 2, layout.frame.left + 12), layout.frame.right - 12)}px`,
        }"
        :aria-label="messages.table.column"
        :title="messages.table.column"
        @pointerdown="onHandleDown('column', $event)"
        @click="openMenu('column')"
      >
        <GripHorizontalIcon />
      </button>
      <template #menu>
        <DouDropdownItem @click="run(insertColumn('before'))">
          <template #prefix><ArrowLeftToLineIcon /></template>
          {{ messages.table.insertLeft }}
        </DouDropdownItem>
        <DouDropdownItem @click="run(insertColumn('after'))">
          <template #prefix><ArrowRightToLineIcon /></template>
          {{ messages.table.insertRight }}
        </DouDropdownItem>
        <DouDropdownItem
          divided
          :disabled="!can(moveLines('column', -1))"
          @click="run(moveLines('column', -1))"
        >
          <template #prefix><ArrowLeftIcon /></template>
          {{ messages.table.moveLeft }}
        </DouDropdownItem>
        <DouDropdownItem
          :disabled="!can(moveLines('column', 1))"
          @click="run(moveLines('column', 1))"
        >
          <template #prefix><ArrowRightIcon /></template>
          {{ messages.table.moveRight }}
        </DouDropdownItem>
        <DouDropdownSub divided :title="aligns.find((item) => item.value === columnAlign)!.label()">
          <template #prefix>
            <component :is="aligns.find((item) => item.value === columnAlign)!.icon" />
          </template>
          <DouDropdownItem
            v-for="item in aligns"
            :key="item.value"
            @click="run(alignColumns(item.value))"
          >
            <template #prefix><component :is="item.icon" /></template>
            {{ item.label() }}
            <template v-if="item.value === columnAlign" #suffix><CheckIcon /></template>
          </DouDropdownItem>
        </DouDropdownSub>
        <DouDropdownItem v-if="target?.rect.left === 0" @click="run(toggleHeader('headerColumn'))">
          <template #prefix><LayoutColumnsIcon /></template>
          {{ messages.table.headerColumn }}
          <template v-if="tableNode?.attrs.headerColumn" #suffix><CheckIcon /></template>
        </DouDropdownItem>
        <DouDropdownItem divided @click="run(clearCells)">
          <template #prefix><EraserIcon /></template>
          {{ messages.table.clear }}
        </DouDropdownItem>
        <DouDropdownItem tone="danger" :disabled="!can(deleteColumns)" @click="run(deleteColumns)">
          <template #prefix><TrashIcon /></template>
          {{ messages.table.deleteColumn }}
        </DouDropdownItem>
      </template>
    </DouDropdown>

    <!-- row handle, left of the row -->
    <DouDropdown
      v-model:open="rowMenu"
      trigger="manual"
      placement="right-start"
      class="dou-editor-menu"
    >
      <button
        type="button"
        tabindex="-1"
        v-show="!barShown"
        class="dou-editor-table__handle is-row"
        :class="{ 'is-active': rowMenu }"
        :style="{
          top: `${layout.row.top + layout.row.height / 2}px`,
          left: `${layout.frame.left}px`,
        }"
        :aria-label="messages.table.row"
        :title="messages.table.row"
        @pointerdown="onHandleDown('row', $event)"
        @click="openMenu('row')"
      >
        <GripVerticalIcon />
      </button>
      <template #menu>
        <DouDropdownItem @click="run(insertRow('before'))">
          <template #prefix><ArrowUpToLineIcon /></template>
          {{ messages.table.insertAbove }}
        </DouDropdownItem>
        <DouDropdownItem @click="run(insertRow('after'))">
          <template #prefix><ArrowDownFromLineIcon /></template>
          {{ messages.table.insertBelow }}
        </DouDropdownItem>
        <DouDropdownItem
          divided
          :disabled="!can(moveLines('row', -1))"
          @click="run(moveLines('row', -1))"
        >
          <template #prefix><ArrowUpIcon /></template>
          {{ messages.table.moveUp }}
        </DouDropdownItem>
        <DouDropdownItem :disabled="!can(moveLines('row', 1))" @click="run(moveLines('row', 1))">
          <template #prefix><ArrowDownIcon /></template>
          {{ messages.table.moveDown }}
        </DouDropdownItem>
        <DouDropdownItem
          v-if="target?.rect.top === 0"
          divided
          @click="run(toggleHeader('headerRow'))"
        >
          <template #prefix><LayoutRowsIcon /></template>
          {{ messages.table.headerRow }}
          <template v-if="tableNode?.attrs.headerRow" #suffix><CheckIcon /></template>
        </DouDropdownItem>
        <DouDropdownItem divided @click="run(clearCells)">
          <template #prefix><EraserIcon /></template>
          {{ messages.table.clear }}
        </DouDropdownItem>
        <DouDropdownItem tone="danger" :disabled="!can(deleteRows)" @click="run(deleteRows)">
          <template #prefix><TrashIcon /></template>
          {{ messages.table.deleteRow }}
        </DouDropdownItem>
      </template>
    </DouDropdown>

    <!-- + bars -->
    <button
      type="button"
      tabindex="-1"
      class="dou-editor-table__add is-column"
      :style="{
        top: `${layout.table.top}px`,
        left: `${Math.min(layout.table.left + layout.table.width, layout.frame.right)}px`,
        height: `${layout.table.height}px`,
      }"
      :aria-label="messages.table.addColumn"
      :title="messages.table.addColumn"
      @click="addAtEnd('column')"
    >
      <PlusIcon />
    </button>
    <button
      type="button"
      tabindex="-1"
      class="dou-editor-table__add is-row"
      :style="{
        top: `${layout.table.top + layout.table.height}px`,
        left: `${layout.frame.left}px`,
        width: `${Math.min(layout.table.left + layout.table.width, layout.frame.right) - layout.frame.left}px`,
      }"
      :aria-label="messages.table.addRow"
      :title="messages.table.addRow"
      @click="addAtEnd('row')"
    >
      <PlusIcon />
    </button>

    <!-- where dragged lines go -->
    <div
      v-if="drop"
      class="dou-editor__drop"
      :class="{ 'is-vertical': drop.axis === 'column' }"
      :style="
        drop.axis === 'row'
          ? {
              top: `${drop.at}px`,
              left: `${layout.frame.left}px`,
              width: `${Math.min(layout.table.left + layout.table.width, layout.frame.right) - layout.frame.left}px`,
            }
          : {
              top: `${layout.table.top}px`,
              left: `${drop.at}px`,
              height: `${layout.table.height}px`,
            }
      "
    />

    <!-- cells: merge, unmerge, clear -->
    <div
      v-if="barShown && layout.bar && !dragging"
      class="dou-editor-table__cells"
      :style="{ top: `${layout.bar.top}px`, left: `${layout.bar.left}px` }"
    >
      <button
        v-if="hasCellSelection"
        type="button"
        tabindex="-1"
        class="dou-editor-table__cells-button"
        :disabled="!can(mergeCells)"
        @click="run(mergeCells)"
      >
        <MergeIcon />{{ messages.table.merge }}
      </button>
      <button
        v-if="can(splitMergedCell)"
        type="button"
        tabindex="-1"
        class="dou-editor-table__cells-button"
        @click="run(splitMergedCell)"
      >
        <SplitIcon />{{ messages.table.split }}
      </button>
      <button
        v-if="hasCellSelection"
        type="button"
        tabindex="-1"
        class="dou-editor-table__cells-button"
        :aria-label="messages.table.clear"
        :title="messages.table.clear"
        @click="run(clearCells)"
      >
        <EraserIcon />
      </button>
    </div>
  </div>
</template>
