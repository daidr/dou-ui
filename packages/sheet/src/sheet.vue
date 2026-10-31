<script setup lang="ts">
import {
  holdPointer,
  isComposing,
  matchesHotkey,
  useLocale,
  useElementSize,
  type PointerHold,
} from 'dou-ui'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRaw, useId, watch } from 'vue'
import {
  boundsOf,
  columnName,
  formatCell,
  formatRange,
  inBounds,
  parseCell,
  parseRange,
  type SheetCellTarget,
  type SheetPoint,
  type SheetRange,
} from './core/address'
import { SheetAxis } from './core/axis'
import { alignOf, formatValue, inputText, parseInput } from './core/format'
import { SheetHistory, type SheetHistoryView } from './core/history'
import {
  cellOf,
  colCountOf,
  isBlank,
  rowCountOf,
  valueOf,
  type SheetData,
  type SheetStyle,
  type SheetValue,
} from './core/model'
import { movePoint, stepIndex, type SheetDirection } from './core/nav'
import {
  clampPoint,
  clampSelection,
  sameSelection,
  selectCell,
  type SheetSelection,
} from './core/selection'
import { SheetTransaction, type SheetTransactionMeta } from './core/transaction'
import { format, useSheetMessages } from './locale'
import type { SheetEmits, SheetExpose, SheetProps } from './types'

defineOptions({ name: 'DouSheet' })

const props = withDefaults(defineProps<SheetProps>(), {
  selection: undefined,
  activeSheet: undefined,
  readonly: false,
  rowHeight: 28,
  colWidth: 96,
  headers: true,
  gridlines: true,
  historyDepth: 100,
  ariaLabel: undefined,
  messages: undefined,
})
const emit = defineEmits<SheetEmits>()

const messages = useSheetMessages(() => props.messages)
const { locale } = useLocale()
/** The language weekdays are named in. */
const lang = computed(() => locale.value.name)
const uid = useId()

const root = ref<HTMLElement>()
const viewport = ref<HTMLElement>()
const editor = ref<HTMLTextAreaElement>()

// The document ---------------------------------------------------------------------------

/*
 * The latest workbook. With `v-model` the prop only catches up when the
 * parent renders again, so changes made in the same tick build on this.
 */
const doc = shallowRef(toRaw(props.modelValue))
/** The last workbook sent out; anything else coming in is a new document. */
let sent = doc.value
const history = new SheetHistory(props.historyDepth)
const canUndo = ref(false)
const canRedo = ref(false)

watch(
  // read past a deep `ref()`: going through its proxies costs more than the grid itself
  () => toRaw(props.modelValue),
  (value) => {
    if (value === doc.value) return
    doc.value = value
    if (value !== sent) {
      // replaced from outside: the history no longer fits it
      history.clear()
      syncHistory()
    }
  },
)

const sheetState = ref(props.activeSheet ?? 0)
watch(
  () => props.activeSheet,
  (value) => {
    if (value != null) sheetState.value = value
  },
)
const sheetIndex = computed(() =>
  Math.max(0, Math.min(doc.value.sheets.length - 1, sheetState.value)),
)

const EMPTY_SHEET: SheetData = { name: '', cells: [] }
const NO_SIZES: Record<number, number> = {}
const sheet = computed(() => doc.value.sheets[sheetIndex.value] ?? EMPTY_SHEET)
const rowCount = computed(() => rowCountOf(sheet.value))
const colCount = computed(() => colCountOf(sheet.value))

/** An axis that is built again only when its count, size or changed sizes do. */
function useAxis(read: () => [count: number, base: number, sizes: Record<number, number>]) {
  let last: SheetAxis | undefined
  return computed(() => {
    const [count, base, sizes] = read()
    if (last && last.count === count && last.base === base && last.sizes === sizes) return last
    return (last = new SheetAxis(count, base, sizes))
  })
}
const rows = useAxis(() => [rowCount.value, props.rowHeight, sheet.value.rowSizes ?? NO_SIZES])
const cols = useAxis(() => [colCount.value, props.colWidth, sheet.value.colSizes ?? NO_SIZES])

const styleCache = computed(() => {
  const cache = new Map<string, { cls: string; css: string; align: boolean }>()
  for (const [name, style] of Object.entries(doc.value.styles ?? {}))
    cache.set(name, compileStyle(style))
  return cache
})

function compileStyle(style: SheetStyle) {
  const cls: string[] = []
  let css = ''
  if (style.bold) cls.push('is-bold')
  if (style.italic) cls.push('is-italic')
  if (style.underline || style.strike)
    css += `text-decoration-line:${[style.underline && 'underline', style.strike && 'line-through'].filter(Boolean).join(' ')};`
  if (style.color) css += `color:${style.color};`
  else if (style.tone) cls.push(`is-tone-${style.tone}`)
  if (style.background) css += `background-color:${style.background};`
  else if (style.fill) cls.push(`is-fill-${style.fill}`)
  if (style.align) cls.push(`is-align-${style.align}`)
  if (style.valign) cls.push(`is-valign-${style.valign}`)
  if (style.wrap) cls.push('is-wrap')
  return { cls: cls.join(' '), css, align: style.align != null }
}

// Layout ---------------------------------------------------------------------------------

const { width: viewWidth, height: viewHeight } = useElementSize(viewport, {
  initial: { width: 960, height: 480 },
})
const scroll = shallowRef({ top: 0, left: 0 })

function onScroll() {
  const el = viewport.value
  if (!el) return
  if (el.scrollTop !== scroll.value.top || el.scrollLeft !== scroll.value.left)
    scroll.value = { top: el.scrollTop, left: el.scrollLeft }
}

/** Wide enough for the longest row number. */
const headerWidth = computed(() =>
  props.headers ? Math.max(40, String(rowCount.value).length * 8 + 16) : 0,
)
const headerHeight = computed(() => (props.headers ? props.rowHeight : 0))
const frozen = computed(() => ({
  rows: Math.max(0, Math.min(rowCount.value, sheet.value.freeze?.rows ?? 0)),
  cols: Math.max(0, Math.min(colCount.value, sheet.value.freeze?.cols ?? 0)),
}))
const frozenHeight = computed(() => rows.value.offset(frozen.value.rows))
const frozenWidth = computed(() => cols.value.offset(frozen.value.cols))
const totalWidth = computed(() => headerWidth.value + cols.value.total)
const bodyHeight = computed(() => rows.value.total - frozenHeight.value)

/** Rows past the edge of the view still drawn, so a quick scroll doesn't show gaps. */
const OVERSCAN = 4

/** The items of `axis` from `from` to `to` (inclusive) that aren't hidden. */
function shown(axis: SheetAxis, from: number, to: number) {
  const list: number[] = []
  for (let i = from; i <= to; i++) if (!axis.hidden(i)) list.push(i)
  return list
}

const frozenRowList = computed(() => shown(rows.value, 0, frozen.value.rows - 1))
const frozenColList = computed(() => shown(cols.value, 0, frozen.value.cols - 1))

/** The same list as before when nothing in it changed, so what depends on it stays put. */
const keep = (list: number[], previous: number[] | undefined) =>
  previous && previous.length === list.length && previous.every((item, i) => item === list[i])
    ? previous
    : list

const bodyRows = computed<number[]>((previous) => {
  const axis = rows.value
  const start = frozen.value.rows
  if (start >= axis.count) return []
  const top = frozenHeight.value + scroll.value.top
  const bottom = scroll.value.top + viewHeight.value - headerHeight.value
  const from = Math.max(start, axis.indexAt(top) - OVERSCAN)
  const list = shown(axis, from, Math.min(axis.count - 1, axis.indexAt(bottom) + OVERSCAN))
  return keep(list, previous)
})

const bodyCols = computed<number[]>((previous) => {
  const axis = cols.value
  const start = frozen.value.cols
  if (start >= axis.count) return []
  const left = frozenWidth.value + scroll.value.left
  const right = scroll.value.left + viewWidth.value - headerWidth.value
  const from = Math.max(start, axis.indexAt(left) - 2)
  return keep(shown(axis, from, Math.min(axis.count - 1, axis.indexAt(right) + 2)), previous)
})

// Selection ------------------------------------------------------------------------------

const selection = shallowRef<SheetSelection>(props.selection ?? selectCell({ row: 0, col: 0 }))
watch(
  () => props.selection,
  (value) => {
    if (value && !sameSelection(value, selection.value)) selection.value = value
  },
)
// a sheet that shrank keeps the selection on it
watch([rowCount, colCount], ([rowsNow, colsNow]) => {
  const next = clampSelection(selection.value, rowsNow, colsNow)
  if (!sameSelection(next, selection.value)) setSelection(next)
})

const selectedBounds = computed(() => selection.value.ranges.map(boundsOf))
const active = computed(() => selection.value.active)

function setSelection(next: SheetSelection) {
  if (sameSelection(next, selection.value)) return
  selection.value = next
  emit('update:selection', next)
}

/** Columns (or rows) any range covers, and the ones a range covers from end to end. */
const headerMarks = computed(() => {
  const colsMarked = new Set<number>()
  const rowsMarked = new Set<number>()
  const colsFull = new Set<number>()
  const rowsFull = new Set<number>()
  const visibleCols = [...frozenColList.value, ...bodyCols.value]
  const visibleRows = [...frozenRowList.value, ...bodyRows.value]
  for (const b of selectedBounds.value) {
    const wholeCols = b.top === 0 && b.bottom === rowCount.value - 1
    const wholeRows = b.left === 0 && b.right === colCount.value - 1
    for (const c of visibleCols)
      if (c >= b.left && c <= b.right) {
        colsMarked.add(c)
        if (wholeCols) colsFull.add(c)
      }
    for (const r of visibleRows)
      if (r >= b.top && r <= b.bottom) {
        rowsMarked.add(r)
        if (wholeRows) rowsFull.add(r)
      }
  }
  return { colsMarked, rowsMarked, colsFull, rowsFull }
})

const focused = ref(false)

// Cells ----------------------------------------------------------------------------------

interface CellView {
  col: number
  text: string
  cls: string
  css: string
}

function cellView(row: number, col: number, line: SheetData['cells'][number]): CellView {
  const input = line?.[col]
  let cls = 'dou-sheet__cell'
  let css = ''
  let text = ''
  if (input != null && input !== '') {
    const cell = typeof input === 'object' ? input : null
    const value = cell ? cell.value : (input as SheetValue)
    text = formatValue(value, cell?.format, lang.value)
    const style = cell?.style ? styleCache.value.get(cell.style) : undefined
    if (style) {
      if (style.cls) cls += ` ${style.cls}`
      css += style.css
    }
    const align = style?.align ? 'left' : alignOf(value)
    if (align !== 'left') cls += ` is-align-${align}`
  }
  for (const b of selectedBounds.value) {
    if (!inBounds(b, row, col)) continue
    if (!cls.includes(' is-selected')) cls += ' is-selected'
    if (row === b.top) cls += ' is-edge-top'
    if (row === b.bottom) cls += ' is-edge-bottom'
    if (col === b.left) cls += ' is-edge-left'
    if (col === b.right) cls += ' is-edge-right'
  }
  if (row === active.value.row && col === active.value.col) cls += ' is-active'
  return { col, text, cls, css }
}

function rowCells(row: number, list: number[]): CellView[] {
  const line = sheet.value.cells[row]
  const axis = cols.value
  const x0 = headerWidth.value
  const edgeCol = frozen.value.cols - 1
  return list.map((col) => {
    const view = cellView(row, col, line)
    const width = axis.size(col)
    view.css = `width:${width}px;left:${x0 + axis.offset(col)}px;${view.css}`
    if (col === edgeCol) view.cls += ' is-freeze-edge'
    return view
  })
}

/*
 * A row is drawn again only when its cells, its part of the selection or
 * the layout change, so scrolling down draws just the rows coming in.
 */
const memoBase = computed(() => [
  rows.value,
  cols.value,
  bodyCols.value,
  frozenColList.value,
  headerWidth.value,
  frozenHeight.value,
  styleCache.value,
  lang.value,
])

/** The selection as it touches one row. */
function rowMarks(row: number) {
  let key = ''
  for (const b of selectedBounds.value)
    if (row >= b.top && row <= b.bottom)
      key += `${b.left},${b.right},${+(row === b.top)}${+(row === b.bottom)};`
  if (row === active.value.row) key += `@${active.value.col}`
  return key
}

const cellId = (row: number, col: number) => `${uid}-${row}-${col}`
const activeId = computed(() => cellId(active.value.row, active.value.col))

/** What the cell the keyboard is on reads as. */
const activeLabel = computed(() => {
  const { row, col } = active.value
  const input = sheet.value.cells[row]?.[col]
  const text = formatValue(valueOf(input), cellOf(input)?.format, lang.value)
  return format(messages.value.cell, {
    cell: formatCell(active.value),
    value: text || messages.value.empty,
  })
})

// Scrolling into view --------------------------------------------------------------------

function scrollToPoint(point: SheetPoint) {
  const el = viewport.value
  if (!el) return
  const { row, col } = point
  if (row >= frozen.value.rows) {
    const top = rows.value.offset(row) - frozenHeight.value
    const bottom = rows.value.offset(row + 1) - frozenHeight.value
    const view = el.clientHeight - headerHeight.value - frozenHeight.value
    if (top < el.scrollTop) el.scrollTop = top
    else if (bottom > el.scrollTop + view) el.scrollTop = Math.min(top, bottom - view)
  }
  if (col >= frozen.value.cols) {
    const left = cols.value.offset(col) - frozenWidth.value
    const right = cols.value.offset(col + 1) - frozenWidth.value
    const view = el.clientWidth - headerWidth.value - frozenWidth.value
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (right > el.scrollLeft + view) el.scrollLeft = Math.min(left, right - view)
  }
  onScroll()
}

/** Where a cell is in the view, in px from its top left corner. */
function cellRect(point: SheetPoint) {
  const { row, col } = point
  let x = headerWidth.value + cols.value.offset(col)
  let y = headerHeight.value + rows.value.offset(row)
  if (col >= frozen.value.cols) x -= scroll.value.left
  if (row >= frozen.value.rows) y -= scroll.value.top
  return { x, y, width: cols.value.size(col), height: rows.value.size(row) }
}

// Changes --------------------------------------------------------------------------------

const sheetSize = () => ({ rows: rowCount.value, cols: colCount.value })

const view = (): SheetHistoryView => ({ sheet: sheetIndex.value, selection: selection.value })

function syncHistory() {
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
}

function apply(tr: SheetTransaction) {
  doc.value = tr.doc
  sent = tr.doc
  emit('update:modelValue', tr.doc)
  emit('transaction', tr)
}

function transact(
  run: (tr: SheetTransaction) => void,
  meta?: SheetTransactionMeta,
  before: SheetHistoryView = view(),
) {
  if (props.readonly) return null
  const tr = new SheetTransaction(doc.value, sheetIndex.value)
  if (meta) tr.setMeta(meta)
  run(tr)
  if (!tr.changed) return null
  apply(tr)
  history.record(tr, before, view())
  syncHistory()
  return tr
}

function travel(direction: 'undo' | 'redo') {
  if (props.readonly) return false
  const result = direction === 'undo' ? history.undo(doc.value) : history.redo(doc.value)
  syncHistory()
  if (!result) return false
  apply(result.tr)
  if (result.view.sheet !== sheetIndex.value) setSheet(result.view.sheet)
  setSelection(result.view.selection)
  scrollToPoint(result.view.selection.active)
  announce(messages.value[direction === 'undo' ? 'undone' : 'redone'])
  return true
}

function setSheet(index: number) {
  if (index === sheetState.value) return
  sheetState.value = index
  emit('update:activeSheet', index)
}

// Editing --------------------------------------------------------------------------------

/**
 * The cell being edited. `enter` started by typing: the arrow keys finish it
 * and move on. `edit` started with F2 or a double click: they move the caret.
 */
const editing = shallowRef<{
  sheet: number
  row: number
  col: number
  mode: 'enter' | 'edit'
} | null>(null)
const editorSize = shallowRef({ width: 0, height: 0 })
let measure: CanvasRenderingContext2D | null | undefined

function beginEdit(mode: 'enter' | 'edit', text?: string) {
  if (props.readonly) {
    announce(messages.value.readonly)
    return false
  }
  const el = editor.value
  if (!el) return false
  const point = active.value
  scrollToPoint(point)
  editing.value = { sheet: sheetIndex.value, ...point, mode }
  if (text != null) el.value = text
  if (document.activeElement !== el) el.focus({ preventScroll: true })
  if (text != null) el.setSelectionRange(el.value.length, el.value.length)
  fitEditor()
  return true
}

function cancelEdit() {
  editing.value = null
  if (editor.value) editor.value.value = ''
}

/** Writes what was typed into the cell, then moves on when told which way. */
function commitEdit(move?: SheetDirection) {
  const e = editing.value
  if (!e) return
  const text = editor.value?.value ?? ''
  cancelEdit()
  const parsed = parseInput(text)
  const before = { sheet: e.sheet, selection: selection.value }
  if (move) moveActive(move)
  const changed = transact(
    (tr) => {
      const at = { sheet: e.sheet, row: e.row, col: e.col }
      const old = cellOf(tr.getCell(at))
      tr.updateCell(at, {
        value: parsed.value ?? undefined,
        format: old?.format ?? parsed.format,
      })
    },
    undefined,
    before,
  )
  if (changed) {
    const cell = changed.doc.sheets[e.sheet]!.cells[e.row]?.[e.col]
    const shownText = formatValue(valueOf(cell), cellOf(cell)?.format, lang.value)
    const value = shownText || messages.value.empty
    announce(format(messages.value.changed, { cell: formatCell(e), value }))
  }
}

/** Grows the editor to fit its text, up to the edge of the view. */
function fitEditor() {
  const el = editor.value
  const e = editing.value
  if (!el || !e) return
  const rect = cellRect(e)
  const maxWidth = Math.max(rect.width, viewWidth.value - rect.x)
  const maxHeight = Math.max(rect.height, viewHeight.value - rect.y)
  const line = sheet.value.cells[e.row]?.[e.col]
  const style = cellOf(line)?.style
  if (style && doc.value.styles?.[style]?.wrap) {
    el.style.height = '0px'
    const height = Math.min(maxHeight, Math.max(rect.height, el.scrollHeight))
    el.style.height = ''
    editorSize.value = { width: rect.width, height }
    return
  }
  measure ??= document.createElement('canvas').getContext('2d')
  const lines = el.value.split('\n')
  let widest = 0
  if (measure) {
    const font = getComputedStyle(el)
    measure.font = `${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`
    for (const text of lines) widest = Math.max(widest, measure.measureText(text).width)
  }
  const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20
  editorSize.value = {
    width: Math.min(maxWidth, Math.max(rect.width, Math.ceil(widest) + 20)),
    height: Math.min(maxHeight, Math.max(rect.height, lines.length * lineHeight + 8)),
  }
}

const inputStyle = computed(() => {
  const point = editing.value ?? active.value
  const rect = cellRect(point)
  if (!editing.value) {
    // kept inside the view, so typing never scrolls anything
    const x = Math.max(0, Math.min(rect.x, viewWidth.value - rect.width))
    const y = Math.max(0, Math.min(rect.y, viewHeight.value - rect.height))
    return `left:${x}px;top:${y}px;width:${rect.width}px;height:${rect.height}px`
  }
  const { width, height } = editorSize.value
  // over the active cell's ring, which covers the grid lines around it
  return `left:${rect.x - 1}px;top:${rect.y - 1}px;width:${Math.max(width, rect.width) + 1}px;height:${Math.max(height, rect.height) + 1}px`
})

const editorClass = computed(() => {
  const e = editing.value
  if (!e) return ''
  const line = sheet.value.cells[e.row]?.[e.col]
  const name = cellOf(line)?.style
  return name ? (styleCache.value.get(name)?.cls ?? '') : ''
})

function onInput() {
  if (!editing.value) {
    // typing on a selected cell starts editing it with what was typed
    if (!beginEdit('enter')) {
      if (editor.value) editor.value.value = ''
      return
    }
  }
  fitEditor()
}

function onCompositionStart() {
  if (!editing.value && !beginEdit('enter') && editor.value) editor.value.value = ''
}

function onInputBlur() {
  focused.value = false
  // switching windows keeps the edit open
  if (editing.value && document.hasFocus()) commitEdit()
}

// Keys -----------------------------------------------------------------------------------

function moveActive(direction: SheetDirection) {
  const next = movePoint(active.value, direction, axes(), filled)
  select(selectCell(next))
}

const axes = () => ({ rows: rows.value, cols: cols.value })
const filled = (row: number, col: number) => !isBlank(sheet.value.cells[row]?.[col])

/** Moves within the selected range (Enter and Tab), wrapping at its edges. */
function moveWithin(direction: 'down' | 'up' | 'right' | 'left') {
  const sel = selection.value
  const range = sel.ranges[sel.ranges.length - 1]!
  const b = boundsOf(range)
  if (b.top === b.bottom && b.left === b.right) return moveActive(direction)
  const step = direction === 'down' || direction === 'right' ? 1 : -1
  let { row, col } = sel.active
  const vertical = direction === 'down' || direction === 'up'
  const width = b.right - b.left + 1
  const height = b.bottom - b.top + 1
  // the cells of the range as one list, by columns (vertical) or rows
  let index = vertical
    ? (col - b.left) * height + (row - b.top)
    : (row - b.top) * width + (col - b.left)
  const count = width * height
  index = (index + step + count) % count
  if (vertical) {
    col = b.left + Math.floor(index / height)
    row = b.top + (index % height)
  } else {
    row = b.top + Math.floor(index / width)
    col = b.left + (index % width)
  }
  setSelection({ active: { row, col }, ranges: sel.ranges })
  scrollToPoint({ row, col })
  announce(activeLabel.value)
}

/** Moves the far corner of the last range, as Shift with an arrow does. */
function extend(direction: SheetDirection, jump: boolean) {
  const sel = selection.value
  const last = sel.ranges[sel.ranges.length - 1]!
  const end = movePoint(last.end, direction, axes(), filled, jump)
  const ranges = [...sel.ranges.slice(0, -1), { start: last.start, end }]
  setSelection({ active: sel.active, ranges })
  scrollToPoint(end)
  announceRange()
}

function announceRange() {
  const range = selection.value.ranges[selection.value.ranges.length - 1]!
  const b = boundsOf(range)
  const count = (b.bottom - b.top + 1) * (b.right - b.left + 1)
  announce(
    count > 1
      ? format(messages.value.selected, { range: formatRange(range, sheetSize()), count })
      : activeLabel.value,
  )
}

/** The rows that fit in the view, for Page Up and Page Down. */
const pageRows = () =>
  Math.max(
    1,
    Math.floor((viewHeight.value - headerHeight.value - frozenHeight.value) / props.rowHeight) - 1,
  )

function onKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  const e = editing.value
  if (e) return editKey(event, e.mode)
  const mod = event.ctrlKey || event.metaKey
  const key = event.key
  const arrow = ARROWS[key]
  if (arrow && !event.altKey) {
    event.preventDefault()
    if (event.shiftKey) return extend(arrow, mod)
    const next = movePoint(active.value, arrow, axes(), filled, mod)
    return select(selectCell(next))
  }
  if (matchesHotkey(event, 'mod+z')) return done(event, travel('undo'))
  if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y'))
    return done(event, travel('redo'))
  if (matchesHotkey(event, 'mod+a')) return done(event, selectAll())
  switch (key) {
    case 'Enter':
      if (mod || event.altKey) return
      event.preventDefault()
      return moveWithin(event.shiftKey ? 'up' : 'down')
    case 'Tab':
      if (mod || event.altKey) return
      event.preventDefault()
      return moveWithin(event.shiftKey ? 'left' : 'right')
    case 'F2':
      event.preventDefault()
      return void beginEdit(
        'edit',
        inputText(valueOf(sheet.value.cells[active.value.row]?.[active.value.col])),
      )
    case 'Delete':
    case 'Backspace':
      event.preventDefault()
      return clearSelection()
    case 'Home': {
      event.preventDefault()
      const to = { row: mod ? 0 : active.value.row, col: 0 }
      return select(selectCell(clampPoint(to, rowCount.value, colCount.value)))
    }
    case 'End': {
      event.preventDefault()
      return select(selectCell(mod ? lastFilled() : endOfRow(active.value.row)))
    }
    case 'PageDown':
    case 'PageUp': {
      event.preventDefault()
      let { row } = active.value
      for (let i = pageRows(); i > 0; i--)
        row = stepIndex(rows.value, row, key === 'PageDown' ? 1 : -1)
      return select(selectCell({ row, col: active.value.col }))
    }
    case ' ':
      if (event.shiftKey && !mod) return done(event, selectLines('row'))
      if (mod && !event.shiftKey) return done(event, selectLines('col'))
      return
  }
}

const ARROWS: Record<string, SheetDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function done(event: KeyboardEvent, handled: unknown) {
  if (handled !== false) event.preventDefault()
}

function editKey(event: KeyboardEvent, mode: 'enter' | 'edit') {
  const key = event.key
  if (key === 'Escape') {
    event.preventDefault()
    cancelEdit()
    return
  }
  if (key === 'Enter' && event.altKey) {
    // a new line inside the cell
    event.preventDefault()
    const el = editor.value!
    el.setRangeText('\n', el.selectionStart, el.selectionEnd, 'end')
    fitEditor()
    return
  }
  if (key === 'Enter') {
    event.preventDefault()
    return commitEdit(event.shiftKey ? 'up' : 'down')
  }
  if (key === 'Tab') {
    event.preventDefault()
    return commitEdit(event.shiftKey ? 'left' : 'right')
  }
  if (key === 'F2') {
    event.preventDefault()
    editing.value = { ...editing.value!, mode: mode === 'enter' ? 'edit' : 'enter' }
    return
  }
  const arrow = ARROWS[key]
  if (arrow && mode === 'enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    return commitEdit(arrow)
  }
}

function endOfRow(row: number): SheetPoint {
  const line = sheet.value.cells[row]
  let col = (line?.length ?? 0) - 1
  while (col > 0 && isBlank(line?.[col])) col--
  return { row, col: Math.max(0, col) }
}

function lastFilled(): SheetPoint {
  const cells = sheet.value.cells
  let row = cells.length - 1
  while (row > 0 && !cells[row]?.some((cell) => !isBlank(cell))) row--
  let col = 0
  for (const line of cells) {
    if (!line) continue
    for (let c = line.length - 1; c > col; c--)
      if (!isBlank(line[c])) {
        col = c
        break
      }
  }
  return { row: Math.max(0, row), col }
}

function selectAll() {
  setSelection({
    active: active.value,
    ranges: [
      { start: { row: 0, col: 0 }, end: { row: rowCount.value - 1, col: colCount.value - 1 } },
    ],
  })
  announceRange()
}

/** Selects the rows (or columns) the last range spans, end to end. */
function selectLines(kind: 'row' | 'col') {
  const sel = selection.value
  const b = boundsOf(sel.ranges[sel.ranges.length - 1]!)
  const range: SheetRange =
    kind === 'row'
      ? { start: { row: b.top, col: 0 }, end: { row: b.bottom, col: colCount.value - 1 } }
      : { start: { row: 0, col: b.left }, end: { row: rowCount.value - 1, col: b.right } }
  setSelection({ active: sel.active, ranges: [...sel.ranges.slice(0, -1), range] })
  announceRange()
}

function clearSelection() {
  if (props.readonly) return announce(messages.value.readonly)
  const ranges = selection.value.ranges
  const cleared = transact((tr) => {
    for (const range of ranges) tr.clearValues(boundsOf(range))
  })
  if (cleared)
    announce(
      format(messages.value.cleared, {
        range: ranges.map((range) => formatRange(range, sheetSize())).join(', '),
      }),
    )
}

/** Selects, scrolls the active cell into view and reads it out. */
function select(next: SheetSelection) {
  setSelection(next)
  scrollToPoint(next.active)
  announce(activeLabel.value)
}

// Pointer --------------------------------------------------------------------------------

interface Hit {
  area: 'cell' | 'col' | 'row' | 'corner'
  row: number
  col: number
}

/** What is under a point of the page; outside the grid, the nearest cell. */
function hitAt(clientX: number, clientY: number): Hit {
  const el = viewport.value!
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left - el.clientLeft
  const y = clientY - rect.top - el.clientTop
  const cx = x - headerWidth.value
  const cy = y - headerHeight.value
  const col = cols.value.indexAt(cx < frozenWidth.value ? cx : cx + scroll.value.left)
  const row = rows.value.indexAt(cy < frozenHeight.value ? cy : cy + scroll.value.top)
  const inCol = cx < 0
  const inRow = cy < 0
  return { area: inCol && inRow ? 'corner' : inRow ? 'col' : inCol ? 'row' : 'cell', row, col }
}

interface Drag {
  pointerId: number
  mode: Hit['area']
  touch: boolean
  started: boolean
  x0: number
  y0: number
  clientX: number
  clientY: number
}

const drag = shallowRef<Drag | null>(null)
let hold: PointerHold | undefined
let pressTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0
/** A tap, kept from `pointerup` for the `click` that follows it. */
let tap: Hit | null = null
let lastPointer: string = 'mouse'

const THRESHOLD = { mouse: 3, touch: 8 }
/** How long a finger rests on a cell before dragging selects, in ms. */
const LONG_PRESS = 400
/** How close to the edge a drag starts scrolling, in px. */
const EDGE = 32
const edgeSpeed = (gap: number) => (gap < EDGE ? Math.ceil(((EDGE - gap) / EDGE) * 20) : 0)

function onPointerDown(event: PointerEvent) {
  const el = viewport.value
  if (!el || (event.button !== 0 && event.button !== 2)) return
  lastPointer = event.pointerType
  const rect = el.getBoundingClientRect()
  // the scrollbars
  if (
    event.clientX - rect.left - el.clientLeft >= el.clientWidth ||
    event.clientY - rect.top - el.clientTop >= el.clientHeight
  )
    return
  const hit = hitAt(event.clientX, event.clientY)
  if (editing.value) commitEdit()
  const touch = event.pointerType === 'touch'
  if (event.button === 2) {
    // a right click keeps a selection it lands in
    if (hit.area === 'cell' && !selectedBounds.value.some((b) => inBounds(b, hit.row, hit.col)))
      press(hit, event)
    focusGrid()
    return
  }
  if (!touch) {
    // keeps the focus where it is and stops text from being selected
    event.preventDefault()
    press(hit, event)
    focusGrid()
  }
  drag.value = {
    pointerId: event.pointerId,
    mode: hit.area,
    touch,
    started: !touch,
    x0: event.clientX,
    y0: event.clientY,
    clientX: event.clientX,
    clientY: event.clientY,
  }
  hold?.release()
  hold = holdPointer(event, root.value)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', stopDrag)
  if (touch) {
    pressTimer = setTimeout(() => {
      const d = drag.value
      if (!d || d.started) return
      // held still: select from here by dragging
      press(hitAt(d.x0, d.y0), { shiftKey: false, ctrlKey: false, metaKey: false })
      d.started = true
      hold?.grab()
      navigator.vibrate?.(8)
      frame = requestAnimationFrame(autoScroll)
    }, LONG_PRESS)
  } else frame = requestAnimationFrame(autoScroll)
}

/** Selects what a press lands on, as Shift and Ctrl / ⌘ say. */
function press(hit: Hit, keys: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  const sel = selection.value
  const last = sel.ranges[sel.ranges.length - 1]!
  const lastRow = rowCount.value - 1
  const lastCol = colCount.value - 1
  if (hit.area === 'corner') return selectAll()
  const range = (start: SheetPoint, end: SheetPoint): SheetRange =>
    hit.area === 'col'
      ? { start: { row: 0, col: start.col }, end: { row: lastRow, col: end.col } }
      : hit.area === 'row'
        ? { start: { row: start.row, col: 0 }, end: { row: end.row, col: lastCol } }
        : { start, end }
  const point = { row: hit.row, col: hit.col }
  if (keys.shiftKey) {
    setSelection({
      active: sel.active,
      ranges: [...sel.ranges.slice(0, -1), range(last.start, point)],
    })
    return
  }
  const fresh = range(point, point)
  // a whole column (or row) starts at its first cell
  setSelection({
    active:
      hit.area === 'col'
        ? { row: 0, col: hit.col }
        : hit.area === 'row'
          ? { row: hit.row, col: 0 }
          : point,
    ranges: keys.ctrlKey || keys.metaKey ? [...sel.ranges, fresh] : [fresh],
  })
}

function onPointerMove(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  d.clientX = event.clientX
  d.clientY = event.clientY
  if (!d.started) {
    // a finger that moves before resting scrolls instead
    if (Math.hypot(event.clientX - d.x0, event.clientY - d.y0) > THRESHOLD.touch) stopDrag()
    return
  }
  dragTo(hitAt(event.clientX, event.clientY))
}

/** Moves the far corner of the range being dragged out. */
function dragTo(hit: Hit) {
  const d = drag.value!
  if (d.mode === 'corner') return
  const sel = selection.value
  const last = sel.ranges[sel.ranges.length - 1]!
  const end =
    d.mode === 'col'
      ? { row: rowCount.value - 1, col: hit.col }
      : d.mode === 'row'
        ? { row: hit.row, col: colCount.value - 1 }
        : { row: hit.row, col: hit.col }
  if (end.row === last.end.row && end.col === last.end.col) return
  setSelection({
    active: sel.active,
    ranges: [...sel.ranges.slice(0, -1), { start: last.start, end }],
  })
}

function autoScroll() {
  const d = drag.value
  const el = viewport.value
  if (!d?.started || !el) return
  const rect = el.getBoundingClientRect()
  const left = rect.left + el.clientLeft + headerWidth.value + frozenWidth.value
  const top = rect.top + el.clientTop + headerHeight.value + frozenHeight.value
  const right = rect.left + el.clientLeft + el.clientWidth
  const bottom = rect.top + el.clientTop + el.clientHeight
  const dx = d.mode === 'row' ? 0 : edgeSpeed(right - d.clientX) || -edgeSpeed(d.clientX - left)
  const dy = d.mode === 'col' ? 0 : edgeSpeed(bottom - d.clientY) || -edgeSpeed(d.clientY - top)
  if (dx || dy) {
    el.scrollLeft += dx
    el.scrollTop += dy
    onScroll()
    dragTo(hitAt(d.clientX, d.clientY))
  }
  frame = requestAnimationFrame(autoScroll)
}

function onPointerUp(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  if (d.touch && !d.started) tap = hitAt(d.x0, d.y0)
  if (d.started) announceRange()
  stopDrag()
}

function stopDrag() {
  clearTimeout(pressTimer)
  cancelAnimationFrame(frame)
  hold?.release()
  hold = undefined
  drag.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', stopDrag)
}

/** A tap selects a cell; a tap on the cell already selected edits it. */
function onClick() {
  const hit = tap
  tap = null
  if (!hit) return
  const sel = selection.value
  const single = sel.ranges.length === 1 && boundsOf(sel.ranges[0]!)
  const again =
    hit.area === 'cell' &&
    single &&
    single.top === single.bottom &&
    single.left === single.right &&
    sel.active.row === hit.row &&
    sel.active.col === hit.col
  if (again && !props.readonly) {
    // inside the tap, so phones show their keyboard
    beginEdit('edit', inputText(valueOf(sheet.value.cells[hit.row]?.[hit.col])))
    return
  }
  press(hit, { shiftKey: false, ctrlKey: false, metaKey: false })
  focusGrid()
  announce(activeLabel.value)
}

function onDblClick(event: MouseEvent) {
  if (lastPointer === 'touch') return
  const hit = hitAt(event.clientX, event.clientY)
  if (hit.area !== 'cell') return
  select(selectCell({ row: hit.row, col: hit.col }))
  beginEdit('edit', inputText(valueOf(sheet.value.cells[hit.row]?.[hit.col])))
}

/**
 * Focuses the grid: the hidden input that takes typing, so that an input
 * method can start on any cell. A finger focuses the grid itself instead,
 * so the keyboard only comes up for editing.
 */
function focusGrid() {
  const target = lastPointer === 'touch' ? viewport.value : editor.value
  if (target && document.activeElement !== target) target.focus({ preventScroll: true })
}

onBeforeUnmount(stopDrag)

// Announcements --------------------------------------------------------------------------

const live = ref('')
function announce(text: string) {
  live.value = ''
  void nextTick(() => (live.value = text))
}
const keysHint = `${uid}-keys`

// Exposed --------------------------------------------------------------------------------

function toPoint(target: SheetCellTarget): SheetPoint | null {
  return typeof target === 'string' ? parseCell(target) : target
}

defineExpose<SheetExpose>({
  transact: (run, meta) => transact(run, meta),
  undo: () => travel('undo'),
  redo: () => travel('redo'),
  get canUndo() {
    return canUndo.value
  },
  get canRedo() {
    return canRedo.value
  },
  select(target) {
    let next: SheetSelection | null = null
    if (typeof target === 'string') {
      const range = parseRange(target)
      if (range) next = { active: range.start, ranges: [range] }
    } else if ('ranges' in target) next = target
    else next = { active: target.start, ranges: [target] }
    if (!next) return
    setSelection(clampSelection(next, rowCount.value, colCount.value))
    scrollToPoint(selection.value.active)
  },
  scrollTo(target) {
    const point = toPoint(target)
    if (point) scrollToPoint(clampPoint(point, rowCount.value, colCount.value))
  },
  edit(target) {
    const point = target == null ? active.value : toPoint(target)
    if (!point) return
    select(selectCell(clampPoint(point, rowCount.value, colCount.value)))
    beginEdit('edit', inputText(valueOf(sheet.value.cells[active.value.row]?.[active.value.col])))
  },
  focus: () => focusGrid(),
})
</script>

<template>
  <div
    ref="root"
    class="dou-sheet"
    :class="{
      'is-focused': focused,
      'is-readonly': readonly,
      'is-dragging': drag?.started,
      'has-gridlines': gridlines,
      'is-editing': editing,
      'is-scrolled-x': scroll.left > 0,
      'is-scrolled-y': scroll.top > 0,
      'has-frozen-cols': frozen.cols > 0,
    }"
    @keydown="onKeydown"
  >
    <div
      ref="viewport"
      class="dou-sheet__viewport"
      role="grid"
      tabindex="-1"
      :aria-label="ariaLabel ?? messages.sheet"
      :aria-rowcount="rowCount + (headers ? 1 : 0)"
      :aria-colcount="colCount + (headers ? 1 : 0)"
      :aria-readonly="readonly || undefined"
      :aria-multiselectable="true"
      :aria-activedescendant="activeId"
      :aria-describedby="keysHint"
      @scroll="onScroll"
      @pointerdown="onPointerDown"
      @click="onClick"
      @dblclick="onDblClick"
      @contextmenu.prevent
      @focus="focused = true"
      @blur="focused = false"
    >
      <div
        class="dou-sheet__head"
        role="rowgroup"
        :style="`width:${totalWidth}px;height:${headerHeight + frozenHeight}px`"
      >
        <div
          v-if="headers"
          class="dou-sheet__row is-header"
          role="row"
          aria-rowindex="1"
          :style="`width:${totalWidth}px;height:${headerHeight}px`"
        >
          <div
            class="dou-sheet__corner"
            role="columnheader"
            :aria-label="messages.selectAll"
            :style="`width:${headerWidth}px`"
          />
          <div
            v-for="col in frozenColList"
            :key="col"
            class="dou-sheet__col-head is-frozen"
            :class="{
              'is-freeze-edge': col === frozen.cols - 1,
              'is-marked': headerMarks.colsMarked.has(col),
              'is-full': headerMarks.colsFull.has(col),
            }"
            role="columnheader"
            :aria-colindex="col + 2"
            :style="`width:${cols.size(col)}px;left:${headerWidth + cols.offset(col)}px`"
          >
            {{ columnName(col) }}
          </div>
          <div
            v-for="col in bodyCols"
            :key="col"
            class="dou-sheet__col-head"
            :class="{
              'is-marked': headerMarks.colsMarked.has(col),
              'is-full': headerMarks.colsFull.has(col),
            }"
            role="columnheader"
            :aria-colindex="col + 2"
            :style="`width:${cols.size(col)}px;left:${headerWidth + cols.offset(col)}px`"
          >
            {{ columnName(col) }}
          </div>
        </div>
        <div
          v-for="row in frozenRowList"
          :key="row"
          v-memo="[sheet.cells[row], memoBase, rowMarks(row)]"
          class="dou-sheet__row is-frozen"
          :class="{ 'is-freeze-edge': row === frozen.rows - 1 }"
          role="row"
          :aria-rowindex="row + (headers ? 2 : 1)"
          :style="`width:${totalWidth}px;height:${rows.size(row)}px`"
        >
          <div
            v-if="headers"
            class="dou-sheet__row-head"
            :class="{
              'is-marked': headerMarks.rowsMarked.has(row),
              'is-full': headerMarks.rowsFull.has(row),
            }"
            role="rowheader"
            :style="`width:${headerWidth}px`"
          >
            {{ row + 1 }}
          </div>
          <div
            v-for="cell in rowCells(row, frozenColList)"
            :id="row === active.row && cell.col === active.col ? activeId : undefined"
            :key="cell.col"
            :class="[cell.cls, 'is-frozen']"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :style="cell.css"
          >
            <span class="dou-sheet__text">{{ cell.text }}</span>
          </div>
          <div
            v-for="cell in rowCells(row, bodyCols)"
            :id="row === active.row && cell.col === active.col ? activeId : undefined"
            :key="cell.col"
            :class="cell.cls"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :style="cell.css"
          >
            <span class="dou-sheet__text">{{ cell.text }}</span>
          </div>
        </div>
      </div>
      <div
        class="dou-sheet__body"
        role="rowgroup"
        :style="`width:${totalWidth}px;height:${bodyHeight}px`"
      >
        <div
          v-for="row in bodyRows"
          :key="row"
          v-memo="[sheet.cells[row], memoBase, rowMarks(row)]"
          class="dou-sheet__row"
          role="row"
          :aria-rowindex="row + (headers ? 2 : 1)"
          :style="`width:${totalWidth}px;height:${rows.size(row)}px;top:${rows.offset(row) - frozenHeight}px`"
        >
          <div
            v-if="headers"
            class="dou-sheet__row-head"
            :class="{
              'is-marked': headerMarks.rowsMarked.has(row),
              'is-full': headerMarks.rowsFull.has(row),
            }"
            role="rowheader"
            :style="`width:${headerWidth}px`"
          >
            {{ row + 1 }}
          </div>
          <div
            v-for="cell in rowCells(row, frozenColList)"
            :id="row === active.row && cell.col === active.col ? activeId : undefined"
            :key="cell.col"
            :class="[cell.cls, 'is-frozen']"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :style="cell.css"
          >
            <span class="dou-sheet__text">{{ cell.text }}</span>
          </div>
          <div
            v-for="cell in rowCells(row, bodyCols)"
            :id="row === active.row && cell.col === active.col ? activeId : undefined"
            :key="cell.col"
            :class="cell.cls"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :style="cell.css"
          >
            <span class="dou-sheet__text">{{ cell.text }}</span>
          </div>
        </div>
      </div>
    </div>
    <textarea
      ref="editor"
      class="dou-sheet__input"
      :class="[editorClass, { 'is-open': editing }]"
      :style="inputStyle"
      :aria-label="editing ? format(messages.edit, { cell: formatCell(editing) }) : activeLabel"
      :aria-describedby="keysHint"
      :readonly="readonly"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      rows="1"
      @input="onInput"
      @compositionstart="onCompositionStart"
      @focus="focused = true"
      @blur="onInputBlur"
    />
    <span :id="keysHint" class="dou-sheet__sr-only">{{ messages.keys }}</span>
    <div class="dou-sheet__sr-only" aria-live="polite">{{ live }}</div>
  </div>
</template>
