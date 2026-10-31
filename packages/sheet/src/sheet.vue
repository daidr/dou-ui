<script setup lang="ts">
import {
  holdPointer,
  isComposing,
  matchesHotkey,
  useLocale,
  useElementSize,
  type PointerHold,
} from 'dou-ui'
import {
  ChevronDownIcon,
  ClipboardPasteIcon,
  ColumnInsertLeftIcon,
  ColumnInsertRightIcon,
  ColumnRemoveIcon,
  CopyIcon,
  EraserIcon,
  EyeIcon,
  EyeOffIcon,
  CellsMergeIcon,
  PlusIcon,
  RowInsertBottomIcon,
  RowInsertTopIcon,
  RowRemoveIcon,
  ScissorsIcon,
  CellsSplitIcon,
  TrashIcon,
} from '@dou-ui/icons'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRaw,
  useId,
  watch,
} from 'vue'
import {
  boundsOf,
  columnName,
  shiftFormula,
  formatCell,
  formatRange,
  inBounds,
  parseCell,
  parseRange,
  type SheetBounds,
  type SheetCellTarget,
  type SheetPoint,
  type SheetRange,
} from './core/address'
import { formatClip, parseClip, type SheetClip } from './core/clipboard'
import { fillContinues, type SheetFillMode } from './core/fill'
import { SheetAxis } from './core/axis'
import { mergesOf } from './core/merge'
import { alignOf, fitNumber, formatValue, inputText, parseInput } from './core/format'
import { SheetHistory, type SheetHistoryView } from './core/history'
import {
  cellOf,
  colCountOf,
  compactCell,
  isBlank,
  rowCountOf,
  valueOf,
  type SheetCellInput,
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
import { SheetTransaction, type SheetAxisName, type SheetTransactionMeta } from './core/transaction'
import SheetMenu from './components/sheet-menu.vue'
import CellPanel from './components/cell-panel.vue'
import { builtinCellTypes } from './cell-types'
import { sheetContextKey, type SheetContext } from './context'
import { resolveCellType, type SheetCellType, type SheetResolvedType } from './core/cell-type'
import { resolveSheetExtensions, type ResolvedSheetExtensions } from './core/extension'
import { format, useSheetMessages } from './locale'
import type {
  SheetEmits,
  SheetExpose,
  SheetMenuContext,
  SheetMenuItem,
  SheetPasteEvent,
  SheetProps,
} from './types'

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
  menu: undefined,
  extensions: () => [],
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

// Extensions and cell types --------------------------------------------------------------

// an equal list written again in a template keeps what was resolved, and the setups with it
const resolved = computed((old?: ResolvedSheetExtensions) => {
  const next = resolveSheetExtensions(props.extensions)
  const same =
    old &&
    old.extensions.length === next.extensions.length &&
    old.extensions.every((e, i) => e === next.extensions[i])
  return same ? old : next
})
/** Cell types by name: the built-in ones, then the extensions', the first named winning. */
const cellTypes = computed(() => {
  const map = new Map<string, SheetCellType>()
  for (const type of builtinCellTypes) map.set(type.name, type)
  const added = new Set<string>()
  for (const type of resolved.value.cellTypes) {
    if (added.has(type.name)) continue
    added.add(type.name)
    map.set(type.name, type)
  }
  return map
})
/** The type of a cell of the sheet shown. */
function typeAt(row: number, col: number): SheetResolvedType | undefined {
  const input = sheet.value.cells[row]?.[col]
  if (input == null || typeof input !== 'object' || !input.type) return undefined
  return resolveCellType(input, doc.value, cellTypes.value)
}
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
/** A row or column whose edge is being dragged, drawn at its new size until let go. */
const sizing = shallowRef<{ axis: SheetAxisName; index: number; size: number } | null>(null)
function sizesOf(axis: SheetAxisName, sizes: Record<number, number>) {
  const s = sizing.value
  return s && s.axis === axis ? { ...sizes, [s.index]: s.size } : sizes
}
const rows = useAxis(() => [
  rowCount.value,
  props.rowHeight,
  sizesOf('row', sheet.value.rowSizes ?? NO_SIZES),
])
const cols = useAxis(() => [
  colCount.value,
  props.colWidth,
  sizesOf('col', sheet.value.colSizes ?? NO_SIZES),
])

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

/**
 * A selection grown to take in the merged cells it touches, with the
 * keyboard on a merged cell's top left cell. Each range keeps the corner
 * it started from.
 */
function fitMerges(sel: SheetSelection): SheetSelection {
  const m = mergesOf(sheet.value)
  if (!m.size) return sel
  let changed = false
  const ranges = sel.ranges.map((range) => {
    const b = boundsOf(range)
    const grown = m.expand(b)
    if (
      grown === b ||
      (grown.top === b.top &&
        grown.left === b.left &&
        grown.bottom === b.bottom &&
        grown.right === b.right)
    )
      return range
    changed = true
    const down = range.end.row >= range.start.row
    const across = range.end.col >= range.start.col
    return {
      start: { row: down ? grown.top : grown.bottom, col: across ? grown.left : grown.right },
      end: { row: down ? grown.bottom : grown.top, col: across ? grown.right : grown.left },
    }
  })
  const active = m.anchor(sel.active)
  if (active !== sel.active) changed = true
  return changed ? { active, ranges } : sel
}
const active = computed(() => selection.value.active)

function setSelection(given: SheetSelection) {
  const next = fitMerges(given)
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
  key?: string
  /** The cell the keyboard is on gets the grid's active id. */
  id?: string
  /** A cell type's own content, drawn instead of the text. */
  render?: SheetCellType['render']
  props?: Record<string, unknown>
  /** What screen readers read for a cell type's own content. */
  label?: string
  /** Left out for screen readers: a cell under a merge, or a merge's piece in another pane. */
  hidden?: boolean
  rowspan?: number
  colspan?: number
}

/**
 * The width of a digit in the grid's font, for fitting numbers into
 * narrow cells; measured once the grid is in the page.
 */
const digitWidth = ref(0)

function measureDigits() {
  const el = root.value
  const context = el && document.createElement('canvas').getContext('2d')
  if (!el || !context) return
  const font = getComputedStyle(el)
  context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`
  digitWidth.value = context.measureText('0123456789').width / 10
}

onMounted(() => {
  measureDigits()
  // a web font that comes in later is wider or narrower
  void document.fonts?.ready.then(measureDigits)
})

const merges = computed(() => mergesOf(sheet.value))
// a selection given from outside, or one a new merge now cuts through, grows over the merges
watch(
  [merges, selection],
  () => {
    const next = fitMerges(selection.value)
    if (next !== selection.value) setSelection(next)
  },
  { immediate: true },
)

/**
 * A cell as drawn. `span` is the merge it shows, for the merged cell
 * itself; the cells a merge covers are drawn empty and see-through, and
 * the merged cell is drawn over them.
 */
function cellView(
  row: number,
  col: number,
  line: SheetData['cells'][number],
  width: number,
  span?: SheetBounds,
): CellView {
  if (!span && merges.value.size && merges.value.at(row, col))
    return { col, text: '', cls: 'dou-sheet__cell is-covered', css: '', hidden: true }
  const input = line?.[col]
  let cls = 'dou-sheet__cell'
  let css = ''
  let text = ''
  let render: CellView['render']
  let renderProps: CellView['props']
  let label: string | undefined
  if (input != null && input !== '') {
    const cell = typeof input === 'object' ? input : null
    const value = cell ? (cell.value ?? null) : (input as SheetValue)
    const typed = cell?.type ? resolveCellType(cell, doc.value, cellTypes.value) : undefined
    text =
      typed?.definition.format?.(value, typed.setup) ?? formatValue(value, cell?.format, lang.value)
    // a number without a format fits the cell, as far as its digits allow
    if (typeof value === 'number' && !cell?.format && !typed?.definition.format && digitWidth.value)
      text = fitNumber(value, Math.max(1, Math.floor((width - 16) / digitWidth.value)))
    const style = cell?.style ? styleCache.value.get(cell.style) : undefined
    if (style) {
      if (style.cls) cls += ` ${style.cls}`
      css += style.css
    }
    const align = style?.align ? 'left' : (typed?.definition.align ?? alignOf(value))
    if (align !== 'left') cls += ` is-align-${align}`
    if (typed) {
      const { definition, setup } = typed
      cls += ` is-type-${definition.name}`
      if (definition.valid && value != null && value !== '' && !definition.valid(value, setup))
        cls += ' is-invalid'
      if (definition.render) {
        render = definition.render
        renderProps = { value, text, setup, readonly: props.readonly }
        label = cellText(input)
      }
    }
  }
  const bottom = span ? span.bottom : row
  const right = span ? span.right : col
  for (const b of selectedBounds.value) {
    if (!inBounds(b, row, col)) continue
    if (!cls.includes(' is-selected')) cls += ' is-selected'
    if (row === b.top) cls += ' is-edge-top'
    if (bottom === b.bottom) cls += ' is-edge-bottom'
    if (col === b.left) cls += ' is-edge-left'
    if (right === b.right) cls += ' is-edge-right'
  }
  if (row === active.value.row && col === active.value.col) cls += ' is-active'
  return render
    ? { col, text, cls, css, render, props: renderProps, label }
    : { col, text, cls, css }
}

function rowCells(row: number, list: number[]): CellView[] {
  const line = sheet.value.cells[row]
  const axis = cols.value
  const x0 = headerWidth.value
  const edgeCol = frozen.value.cols - 1
  const views = list.map((col) => {
    const width = axis.size(col)
    const view = cellView(row, col, line, width)
    view.css = `width:${width}px;left:${x0 + axis.offset(col)}px;${view.css}`
    if (col === edgeCol) view.cls += ' is-freeze-edge'
    if (row === active.value.row && col === active.value.col && !view.cls.includes('is-covered'))
      view.id = activeId.value
    return view
  })
  if (merges.value.size) addMergedCells(row, list, views)
  return views
}

/**
 * The first of `list` (sorted) from `from` to `to`, or `-1`: where a
 * merged cell is drawn when its own top left cell is out of view.
 */
function firstIn(list: readonly number[], from: number, to: number) {
  for (const i of list) {
    if (i > to) return -1
    if (i >= from) return i
  }
  return -1
}

/**
 * Adds the merged cells drawn from this row and these columns. A merge is
 * drawn once in each pane it reaches, from its first row and column drawn
 * there, so it shows even when its top left cell has scrolled away. In a
 * frozen pane it stops at the pane's edge; the text goes in the pane with
 * the merge's top left cell.
 */
function addMergedCells(row: number, list: number[], views: CellView[]) {
  const f = frozen.value
  const frozenCols = list === frozenColList.value
  const rowList = row < f.rows ? frozenRowList.value : bodyRows.value
  const r = rows.value
  const c = cols.value
  const x0 = headerWidth.value
  for (const m of merges.value.inRow(row)) {
    const paneTop = row < f.rows ? m.top : Math.max(m.top, f.rows)
    if (firstIn(rowList, paneTop, m.bottom) !== row) continue
    const paneLeft = frozenCols ? m.left : Math.max(m.left, f.cols)
    const paneRight = frozenCols ? Math.min(m.right, f.cols - 1) : m.right
    if (paneLeft > paneRight || firstIn(list, paneLeft, paneRight) === -1) continue
    const right = frozenCols ? paneRight : m.right
    const bottom = row < f.rows ? Math.min(m.bottom, f.rows - 1) : m.bottom
    const width = c.offset(right + 1) - c.offset(m.left)
    const height = r.offset(bottom + 1) - r.offset(m.top)
    const anchor = sheet.value.cells[m.top]
    const view = cellView(m.top, m.left, anchor, width, m)
    // the text shows once, in the pane holding the top left cell
    const home = !((!frozenCols && m.left < f.cols) || (row >= f.rows && m.top < f.rows))
    if (home) {
      view.rowspan = m.bottom - m.top + 1
      view.colspan = m.right - m.left + 1
    } else {
      view.text = ''
      view.render = undefined
      view.hidden = true
    }
    view.cls += ' is-merged'
    view.key = `m${m.left}`
    if (home && active.value.row === m.top && active.value.col === m.left) view.id = activeId.value
    if (right >= f.cols - 1 && m.left < f.cols && frozenCols) view.cls += ' is-freeze-edge'
    const top = r.offset(m.top) - r.offset(row)
    const left = x0 + c.offset(m.left)
    view.css = frozenCols
      ? `width:${width}px;height:${height}px;left:${left}px;margin-top:${top}px;margin-right:${-width}px;${view.css}`
      : `width:${width}px;height:${height}px;left:${left}px;top:${top}px;${view.css}`
    // in the frozen columns it sits in the flow, just before the cells it covers
    const at = frozenCols ? views.findIndex((v) => v.col === m.left) : views.length
    views.splice(at === -1 ? views.length : at, 0, view)
  }
}

/** What a row's merged cells depend on beyond the row itself, for `v-memo`. */
function mergeKey(row: number) {
  if (!merges.value.size) return ''
  let key = ''
  for (const m of merges.value.inRow(row))
    key += `${m.top},${m.left}:${rowId(sheet.value.cells[m.top])}:${rowMarks(m.top)}|${rowMarks(m.bottom)};`
  return key ? `${key}${bodyRows.value[0]}` : ''
}

const rowIds = new WeakMap<object, number>()
let lastRowId = 0
function rowId(line: SheetData['cells'][number]) {
  if (!line) return 0
  let id = rowIds.get(line)
  if (id == null) rowIds.set(line, (id = ++lastRowId))
  return id
}

/*
 * A row is drawn again only when its cells, its part of the selection or
 * the layout change, so scrolling down draws just the rows coming in.
 */
const memoBase = computed(() => [
  merges.value,
  rows.value,
  cols.value,
  bodyCols.value,
  frozenColList.value,
  headerWidth.value,
  frozenHeight.value,
  styleCache.value,
  lang.value,
  digitWidth.value,
  doc.value.types,
  cellTypes.value,
  props.readonly,
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
  const text = cellText(sheet.value.cells[row]?.[col])
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
  // a merged cell is as big as its merge
  const span = merges.value.cell(point)
  const { top: row, left: col } = span
  let x = headerWidth.value + cols.value.offset(col)
  let y = headerHeight.value + rows.value.offset(row)
  if (col >= frozen.value.cols) x -= scroll.value.left
  if (row >= frozen.value.rows) y -= scroll.value.top
  return {
    x,
    y,
    width: cols.value.offset(span.right + 1) - cols.value.offset(col),
    height: rows.value.offset(span.bottom + 1) - rows.value.offset(row),
  }
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
  /** Leave the copied range marked, as pasting a copy does. */
  keepMark = false,
) {
  if (props.readonly) return null
  const tr = new SheetTransaction(doc.value, sheetIndex.value)
  tr.setMeta({ action: 'api', ...meta })
  run(tr)
  if (!tr.changed) return null
  for (const hook of resolved.value.transactions) hook(tr, context)
  if (!keepMark) clipMark.value = null
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
  result.tr.setMeta({ action: direction })
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
/** What is typed in the editor, and whether anything was typed since it opened. */
const editText = ref('')
const editTyped = ref(false)
/** The value of the cell being edited, as it was. */
const editValue = shallowRef<SheetValue>(null)
/** Whether editing began with a finger: a type's panel then shows without the keyboard over it. */
const editByTouch = ref(false)
const panel = shallowRef<InstanceType<typeof CellPanel> | null>(null)
/** The type of the cell being edited, when it has a panel to show under it. */
const panelType = computed(() => {
  const e = editing.value
  if (!e || e.sheet !== sheetIndex.value) return undefined
  const typed = typeAt(e.row, e.col)
  return typed?.definition.panel ? typed : undefined
})

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
  editValue.value = valueOf(sheet.value.cells[point.row]?.[point.col])
  editTyped.value = false
  editByTouch.value = lastPointer === 'touch'
  if (text != null) el.value = text
  editText.value = el.value
  if (document.activeElement !== el) el.focus({ preventScroll: true })
  if (text != null) el.setSelectionRange(el.value.length, el.value.length)
  fitEditor()
  return true
}

function cancelEdit() {
  editing.value = null
  editText.value = ''
  editTyped.value = false
  if (editor.value) editor.value.value = ''
}

/** Writes what was typed into the cell, then moves on when told which way. */
function commitEdit(move?: SheetDirection) {
  const e = editing.value
  if (!e) return
  const text = editor.value?.value ?? ''
  const typed = e.sheet === sheetIndex.value ? typeAt(e.row, e.col) : undefined
  cancelEdit()
  const parsed = typed?.definition.parse?.(text, typed.setup) ?? parseInput(text)
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
    { action: 'input' },
    before,
  )
  if (changed) announceChange(e)
}

/** Says what a cell now holds. */
function announceChange(at: { sheet: number; row: number; col: number }) {
  const cell = doc.value.sheets[at.sheet]?.cells[at.row]?.[at.col]
  const value = cellText(cell) || messages.value.empty
  announce(format(messages.value.changed, { cell: formatCell(at), value }))
}

/** A cell's value as it reads: its text, or whether it is checked. */
function cellText(input: SheetCellInput) {
  const value = valueOf(input)
  const cell = cellOf(input)
  const typed = cell?.type ? resolveCellType(cell, doc.value, cellTypes.value) : undefined
  if (typed?.definition.toggle)
    return value === true ? messages.value.checked : messages.value.unchecked
  return (
    typed?.definition.format?.(value, typed.setup) ?? formatValue(value, cell?.format, lang.value)
  )
}

/** Writes a value picked in a cell type's panel and finishes editing. */
function pickValue(value: SheetValue) {
  const e = editing.value
  if (!e) return
  cancelEdit()
  const changed = transact(
    (tr) => tr.updateCell({ sheet: e.sheet, row: e.row, col: e.col }, { value }),
    { action: 'input' },
  )
  if (changed) announceChange(e)
  focusGrid()
}

/**
 * Switches the cells of a type with a `toggle`: one cell, or every selected
 * one of the active cell's type. Those all become the same: what their
 * shared value switches to, or, when they differ, what an empty cell does.
 */
function toggleCells(only?: SheetPoint) {
  const at = only ?? active.value
  const typed = typeAt(at.row, at.col)
  const toggle = typed?.definition.toggle
  if (!typed || !toggle) return false
  if (props.readonly) {
    announce(messages.value.readonly)
    return true
  }
  const points: SheetPoint[] = []
  if (only) points.push(only)
  else {
    const cells = sheet.value.cells
    const seen = new Set<string>()
    for (const b of selectedBounds.value)
      for (let row = b.top; row <= Math.min(b.bottom, cells.length - 1); row++) {
        const line = cells[row]
        if (!line) continue
        for (let col = b.left; col <= Math.min(b.right, line.length - 1); col++) {
          const key = `${row}:${col}`
          if (seen.has(key) || typeAt(row, col)?.definition !== typed.definition) continue
          seen.add(key)
          points.push({ row, col })
        }
      }
  }
  const values = points.map((p) => valueOf(sheet.value.cells[p.row]?.[p.col]))
  const same = values.every((value) => value === values[0])
  const next = toggle(same ? (values[0] ?? null) : null, typed.setup)
  const changed = transact(
    (tr) => {
      for (const point of points) tr.updateCell(point, { value: next })
    },
    { action: 'input' },
  )
  if (changed) announceChange({ sheet: sheetIndex.value, ...at })
  return true
}

/** The text a cell's editor starts with: what its type gives, or the value as typed. */
function editTextAt(row: number, col: number) {
  const value = valueOf(sheet.value.cells[row]?.[col])
  const typed = typeAt(row, col)
  if (!typed) return inputText(value)
  const { definition, setup } = typed
  const text = definition.edit
    ? definition.edit(value, setup)
    : value == null
      ? undefined
      : definition.format?.(value, setup)
  return text ?? inputText(value)
}

/** Edits the active cell when its type has a panel, which then shows. */
function openPanel() {
  const { row, col } = active.value
  if (!typeAt(row, col)?.definition.panel) return false
  beginEdit('edit', editTextAt(row, col))
  return true
}

/** Where the active cell's panel button goes: on its right edge, while it isn't edited. */
const panelButton = computed(() => {
  if (props.readonly || editing.value || drag.value) return null
  const { row, col } = active.value
  if (!typeAt(row, col)?.definition.panel) return null
  const rect = visibleRect(active.value)
  return rect && { x: rect.x + rect.width, y: rect.y + rect.height / 2 }
})

/** Edits the active cell, or switches it when its type toggles. */
function editActive() {
  if (toggleCells()) return
  const { row, col } = active.value
  beginEdit('edit', editTextAt(row, col))
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
  editText.value = editor.value?.value ?? ''
  editTyped.value = true
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

/**
 * Where the keys entered the merged cell that's active, so leaving it keeps
 * to the same column (or row) instead of the merge's first.
 */
let entered: { point: SheetPoint; selection: SheetSelection } | undefined

function moveActive(direction: SheetDirection, jump = false) {
  // out of a merged cell from its far side
  const span = merges.value.cell(active.value)
  // only while the selection is still the one the keys made
  const track =
    entered &&
    entered.selection === selection.value &&
    merges.value.at(entered.point.row, entered.point.col) === span
      ? entered.point
      : active.value
  const from = {
    row: direction === 'down' ? span.bottom : direction === 'up' ? span.top : track.row,
    col: direction === 'right' ? span.right : direction === 'left' ? span.left : track.col,
  }
  const next = movePoint(from, direction, axes(), filled, jump)
  select(selectCell(next))
  entered = merges.value.at(next.row, next.col)
    ? { point: next, selection: selection.value }
    : undefined
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
  for (const keymap of keymaps.value)
    for (const combo in keymap)
      if (matchesHotkey(event, combo) && keymap[combo]!(event) !== false)
        return event.preventDefault()
  const mod = event.ctrlKey || event.metaKey
  const key = event.key
  const arrow = ARROWS[key]
  // Alt + ↓ opens a cell type's panel, such as the list to pick from
  if (key === 'ArrowDown' && event.altKey && !mod && openPanel()) return event.preventDefault()
  if (arrow && !event.altKey) {
    event.preventDefault()
    if (event.shiftKey) return extend(arrow, mod)
    return moveActive(arrow, mod)
  }
  if (matchesHotkey(event, 'mod+z')) return done(event, travel('undo'))
  if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y'))
    return done(event, travel('redo'))
  if (matchesHotkey(event, 'mod+a')) return done(event, selectAll())
  if (matchesHotkey(event, 'mod+d') || matchesHotkey(event, 'mod+r')) {
    event.preventDefault()
    if (props.readonly) return announce(messages.value.readonly)
    return fillFromEdge(key.toLowerCase() === 'd' ? 'down' : 'right')
  }
  if (key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) {
    event.preventDefault()
    return openMenuAtActive()
  }
  // with whole rows (or columns) selected: insert before them, or delete them
  if (mod && !event.altKey && (key === '-' || key === '+' || key === '=')) {
    const b = lastBounds()
    const axis = whole(b, 'row') ? 'row' : whole(b, 'col') ? 'col' : null
    if (!axis || (key === '=' && !event.shiftKey)) return
    event.preventDefault()
    if (props.readonly) return announce(messages.value.readonly)
    return key === '-' ? deleteLines(axis) : insertLines(axis, false)
  }
  switch (key) {
    case 'Escape':
      if (clipMark.value) {
        event.preventDefault()
        clipMark.value = null
      }
      return
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
      return editActive()
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
      if (!event.shiftKey && !mod && !event.altKey && toggleCells()) return event.preventDefault()
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
  // a cell type's panel gets the keys first, such as the arrows in a list
  if (panel.value?.onKey(event)) return event.preventDefault()
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
  const cleared = transact(
    (tr) => {
      for (const range of ranges) tr.clearValues(boundsOf(range))
    },
    { action: 'clear' },
  )
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

// Ranges in the view ---------------------------------------------------------------------

interface ViewRect {
  x: number
  y: number
  width: number
  height: number
  /** Edges cut off by the view or the frozen panes, which are not drawn. */
  cut: { top: boolean; right: boolean; bottom: boolean; left: boolean }
}

/** Where a range shows in the view; `null` when none of it does. */
function rangeRect(b: SheetBounds): ViewRect | null {
  const r = rows.value
  const c = cols.value
  const f = frozen.value
  const { left: sx, top: sy } = scroll.value
  const x0 = headerWidth.value
  const y0 = headerHeight.value
  const left = x0 + c.offset(b.left) - (b.left >= f.cols ? sx : 0)
  const right = x0 + c.offset(b.right + 1) - (b.right >= f.cols ? sx : 0)
  const top = y0 + r.offset(b.top) - (b.top >= f.rows ? sy : 0)
  const bottom = y0 + r.offset(b.bottom + 1) - (b.bottom >= f.rows ? sy : 0)
  // what scrolled under the frozen panes is hidden there
  const minX = b.left >= f.cols ? x0 + frozenWidth.value : x0
  const minY = b.top >= f.rows ? y0 + frozenHeight.value : y0
  const x = Math.max(left, minX)
  const y = Math.max(top, minY)
  const x2 = Math.min(right, viewWidth.value)
  const y2 = Math.min(bottom, viewHeight.value)
  if (x2 <= x || y2 <= y) return null
  return {
    x,
    y,
    width: x2 - x,
    height: y2 - y,
    cut: { left: x > left, top: y > top, right: x2 < right, bottom: y2 < bottom },
  }
}

const rectStyle = (rect: ViewRect) =>
  `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;` +
  (['top', 'right', 'bottom', 'left'] as const)
    .filter((side) => rect.cut[side])
    .map((side) => `border-${side}-color:transparent;`)
    .join('')

/** The last range of the selection, kept inside the sheet. */
function lastBounds() {
  const sel = selection.value
  const b = boundsOf(sel.ranges[sel.ranges.length - 1]!)
  return {
    top: Math.max(0, b.top),
    left: Math.max(0, b.left),
    bottom: Math.min(rowCount.value - 1, b.bottom),
    right: Math.min(colCount.value - 1, b.right),
  }
}

/** Whether a range runs the whole height (`col`) or width (`row`) of the sheet. */
const whole = (b: SheetBounds, axis: SheetAxisName) =>
  axis === 'col'
    ? b.top === 0 && b.bottom >= rowCount.value - 1
    : b.left === 0 && b.right >= colCount.value - 1

const rangeName = (b: SheetBounds) =>
  formatRange(
    { start: { row: b.top, col: b.left }, end: { row: b.bottom, col: b.right } },
    sheetSize(),
  )

// Clipboard ------------------------------------------------------------------------------

/** The range last copied or cut, outlined until it is pasted (cut), edited or Escape. */
const clipMark = shallowRef<{ sheet: number; bounds: SheetBounds; cut: string | null } | null>(null)
const clipRect = computed(() => {
  const mark = clipMark.value
  return mark && mark.sheet === sheetIndex.value ? rangeRect(mark.bounds) : null
})

/** The cells of a range as a clip, up to where the sheet has data. */
function clipOf(b: SheetBounds, cut: string | null): SheetClip {
  const data = sheet.value.cells
  let bottom = b.bottom
  let right = b.right
  // a whole row or column copies up to the last cell with something in it
  if (whole(b, 'col')) bottom = Math.max(b.top, Math.min(bottom, data.length - 1))
  if (whole(b, 'row')) {
    let widest = 0
    for (let r = b.top; r <= bottom; r++) widest = Math.max(widest, data[r]?.length ?? 0)
    right = Math.max(b.left, Math.min(right, widest - 1))
  }
  const cells: SheetCellInput[][] = []
  const used = new Set<string>()
  for (let r = b.top; r <= bottom; r++) {
    const line: SheetCellInput[] = []
    for (let c = b.left; c <= right; c++) {
      const cell = data[r]?.[c] ?? undefined
      line.push(cell)
      const style = cellOf(cell)?.style
      if (style) used.add(style)
    }
    cells.push(line)
  }
  const styles: Record<string, SheetStyle> = {}
  for (const name of used) {
    const style = doc.value.styles?.[name]
    if (style) styles[name] = style
  }
  const clip: SheetClip = { cells, from: { row: b.top, col: b.left } }
  if (used.size) clip.styles = styles
  if (cut) clip.cut = cut
  return clip
}

let cutCount = 0

/** Puts the selection on the clipboard; returns what to write there. */
function takeClip(cut: boolean) {
  const b = lastBounds()
  const id = cut ? `${uid}-${++cutCount}` : null
  const clip = clipOf(b, id)
  const height = clip.cells.length
  const width = clip.cells[0]?.length ?? 1
  const bounds = { top: b.top, left: b.left, bottom: b.top + height - 1, right: b.left + width - 1 }
  clipMark.value = { sheet: sheetIndex.value, bounds, cut: id }
  announce(format(messages.value[cut ? 'cutDone' : 'copied'], { range: rangeName(bounds) }))
  return formatClip(clip, {
    locale: lang.value,
    // as cell types show their values, such as 80% for 0.8
    text: (input) => {
      const cell = cellOf(input)
      const typed = cell?.type ? resolveCellType(cell, doc.value, cellTypes.value) : undefined
      return typed?.definition.format?.(valueOf(input), typed.setup)
    },
  })
}

function onCopy(event: ClipboardEvent) {
  if (editing.value || !event.clipboardData) return
  event.preventDefault()
  const { text, html } = takeClip(false)
  event.clipboardData.setData('text/plain', text)
  event.clipboardData.setData('text/html', html)
}

function onCut(event: ClipboardEvent) {
  if (editing.value || !event.clipboardData) return
  event.preventDefault()
  if (props.readonly) return announce(messages.value.readonly)
  const { text, html } = takeClip(true)
  event.clipboardData.setData('text/plain', text)
  event.clipboardData.setData('text/html', html)
}

function onPaste(event: ClipboardEvent) {
  if (editing.value || !event.clipboardData) return
  event.preventDefault()
  const clip = parseClip({
    html: event.clipboardData.getData('text/html'),
    text: event.clipboardData.getData('text/plain'),
  })
  if (clip) paste(clip)
}

/** Copies or cuts with the clipboard API, for the menu. */
async function copyToClipboard(cut: boolean) {
  if (cut && props.readonly) return announce(messages.value.readonly)
  const { text, html } = takeClip(cut)
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
    } else await navigator.clipboard.writeText(text)
  } catch {
    clipMark.value = null
  }
}

/** Pastes with the clipboard API, for the menu; says how to paste when the browser won't allow it. */
async function pasteFromClipboard() {
  if (props.readonly) return announce(messages.value.readonly)
  try {
    let html = ''
    let text = ''
    if (navigator.clipboard?.read) {
      for (const item of await navigator.clipboard.read()) {
        if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text()
        if (item.types.includes('text/plain'))
          text = await (await item.getType('text/plain')).text()
      }
    } else text = await navigator.clipboard.readText()
    const clip = parseClip({ html, text })
    if (clip) paste(clip)
  } catch {
    const key = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'
    showNotice(format(messages.value.pasteBlocked, { key }))
  }
}

/** Gives pasted styles names that don't clash with different styles of the same name. */
function styleNames(tr: SheetTransaction, styles: Record<string, SheetStyle> | undefined) {
  const names = new Map<string, string>()
  for (const [name, style] of Object.entries(styles ?? {})) {
    const json = JSON.stringify(style)
    let next = name
    for (let n = 2; ; n++) {
      const existing = tr.doc.styles?.[next]
      if (!existing || JSON.stringify(existing) === json) break
      next = `${name} ${n}`
    }
    if (!tr.doc.styles?.[next]) tr.setStyle(next, style)
    names.set(name, next)
  }
  return names
}

/** Where a clip goes when pasted at the selection. */
function pasteTargets(clip: SheetClip) {
  const height = clip.cells.length
  const width = Math.max(1, ...clip.cells.map((line) => line.length))
  const b = lastBounds()
  if (height === 1 && width === 1) return selection.value.ranges.map(boundsOf)
  if ((b.bottom - b.top + 1) % height === 0 && (b.right - b.left + 1) % width === 0) return [b]
  return [{ top: b.top, left: b.left, bottom: b.top + height - 1, right: b.left + width - 1 }]
}

/**
 * Pastes a clip at the selection. One cell fills every selected cell; a
 * block fills a range that is a whole number of copies of it; otherwise
 * it goes at the top left of the range. A cut moves its cells. The
 * `paste` event comes first and may change the clip or stop the paste.
 */
function paste(given: SheetClip) {
  if (props.readonly) return announce(messages.value.readonly)
  if (!given.cells.length) return
  const event: SheetPasteEvent = {
    clip: given,
    range: boundsRange(pasteTargets(given)[0]!),
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
  emit('paste', event)
  if (event.defaultPrevented) return
  const clip = event.clip
  const height = clip.cells.length
  if (!height) return
  const width = Math.max(1, ...clip.cells.map((line) => line.length))
  const ours = clip.from != null
  const mark = clipMark.value
  const moving = clip.cut != null && mark?.cut === clip.cut ? mark : null
  const targets = moving
    ? [
        {
          ...lastBounds(),
          bottom: lastBounds().top + height - 1,
          right: lastBounds().left + width - 1,
        },
      ]
    : pasteTargets(clip)
  const changed = transact(
    (tr) => {
      if (moving) {
        // the cells themselves move, and formulas pointing at them follow
        return void tr.moveCells(
          { ...moving.bounds, sheet: moving.sheet },
          { row: targets[0]!.top, col: targets[0]!.left },
        )
      }
      const names = styleNames(tr, clip.styles)
      for (const t of targets)
        for (let r = t.top; r <= t.bottom; r++)
          for (let c = t.left; c <= t.right; c++) {
            const dr = (r - t.top) % height
            const dc = (c - t.left) % width
            const input = clip.cells[dr]?.[dc]
            const at = { row: r, col: c }
            if (!ours) {
              // text from elsewhere: the value and the format it implies, keeping the cell's style
              const cell = cellOf(input)
              const old = cellOf(tr.getCell(at))
              tr.updateCell(at, {
                value: cell?.value ?? undefined,
                format: cell?.format ?? old?.format,
              })
              continue
            }
            const cell = cellOf(input)
            let value = cell?.value
            if (typeof value === 'string' && value.startsWith('='))
              value = shiftFormula(value, r - dr - clip.from!.row, c - dc - clip.from!.col)
            const style = cell?.style ? (names.get(cell.style) ?? cell.style) : undefined
            tr.setCell(
              at,
              cell ? compactCell({ ...cell, value: value ?? undefined, style }) : undefined,
            )
          }
    },
    { action: moving ? 'cut' : 'paste' },
    view(),
    !moving,
  )
  if (moving) clipMark.value = null
  const last = targets[targets.length - 1]!
  if (targets.length === 1)
    setSelection({ active: { row: last.top, col: last.left }, ranges: [boundsRange(last)] })
  scrollToPoint({ row: last.top, col: last.left })
  if (changed) announce(format(messages.value.pasted, { range: targets.map(rangeName).join(', ') }))
}

const boundsRange = (b: SheetBounds): SheetRange => ({
  start: { row: b.top, col: b.left },
  end: { row: b.bottom, col: b.right },
})

/** A short message over the grid, for what can't be read out alone. */
const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function showNotice(text: string) {
  notice.value = text
  announce(text)
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3200)
}

// Filling --------------------------------------------------------------------------------

/** The fill handle shows at the corner of a single range that can change. */
const fillRect = computed(() => {
  if (props.readonly || editing.value || selection.value.ranges.length !== 1) return null
  if (drag.value?.mode === 'move' || sizing.value) return null
  const b = lastBounds()
  const corner = rangeRect({ top: b.bottom, left: b.right, bottom: b.bottom, right: b.right })
  if (!corner || corner.cut.right || corner.cut.bottom) return null
  return { x: corner.x + corner.width, y: corner.y + corner.height }
})

/** Where a fill drag would fill to, and the cells it would clear when dragged back in. */
const fillTarget = shallowRef<{ bounds: SheetBounds; clear: SheetBounds | null } | null>(null)
const fillPreview = computed(() => {
  const t = fillTarget.value
  return t ? rangeRect(t.bounds) : null
})
/** Whether Ctrl / ⌘ is held while dragging the fill handle. */
const fillInvert = ref(false)

/**
 * What the last filled cell will show, beside the far corner of the fill,
 * found by filling the first line in a transaction that is thrown away.
 */
const fillHint = computed(() => {
  const target = fillTarget.value
  if (!target || target.clear) return null
  const b = lastBounds()
  const t = target.bounds
  if (t.top === b.top && t.bottom === b.bottom && t.left === b.left && t.right === b.right)
    return null
  const down = t.left === b.left && t.right === b.right
  const one = (x: SheetBounds) => (down ? { ...x, right: x.left } : { ...x, bottom: x.top })
  const end = down
    ? { row: t.bottom > b.bottom ? t.bottom : t.top, col: b.left }
    : { row: b.top, col: t.right > b.right ? t.right : t.left }
  const tr = new SheetTransaction(doc.value, sheetIndex.value)
  try {
    tr.fill(one(b), one(t), { mode: fillMode(b, t, fillInvert.value) })
  } catch {
    return null
  }
  const input = tr.doc.sheets[sheetIndex.value]!.cells[end.row]?.[end.col]
  const text = formatValue(valueOf(input), cellOf(input)?.format, lang.value)
  const rect = rangeRect({ top: end.row, left: end.col, bottom: end.row, right: end.col })
  if (!rect || !text) return null
  // near the right edge it goes on the cell's left instead
  const flip = rect.x + rect.width + 160 > viewWidth.value && rect.x > 160
  return { text, flip, x: flip ? rect.x : rect.x + rect.width, y: rect.y + rect.height / 2 }
})

const fillClearRect = computed(() => {
  const t = fillTarget.value
  return t?.clear ? rangeRect(t.clear) : null
})

/**
 * How far from the selection's corner the handle was pressed, in px: a
 * finger lands anywhere on its larger target, and the fill follows how
 * the finger moves from there rather than where it first touched.
 */
let fillGrab = { x: 0, y: 0 }

/** The way a fill drag is going, so the grid scrolls only that way. */
let fillAxis: SheetAxisName | null = null

/**
 * What dragging the fill handle to a point would fill: the range grown the
 * way the pointer went further past it, or shrunk when dragged back in.
 */
function fillTo(hit: Hit) {
  const b = lastBounds()
  const x = hit.x - fillGrab.x
  const y = hit.y - fillGrab.y
  const r = rows.value.indexAt(y)
  const c = cols.value.indexAt(x)
  const top = rows.value.offset(b.top)
  const bottom = rows.value.offset(b.bottom + 1)
  const left = cols.value.offset(b.left)
  const right = cols.value.offset(b.right + 1)
  const outY = y > bottom ? y - bottom : y < top ? y - top : 0
  const outX = x > right ? x - right : x < left ? x - left : 0
  fillAxis = outY === 0 && outX === 0 ? null : Math.abs(outY) >= Math.abs(outX) ? 'row' : 'col'
  if (outY === 0 && outX === 0) {
    // back inside: the cells past the pointer would be cleared
    const up = b.bottom - r
    const back = b.right - c
    if (up === 0 && back === 0) return { bounds: b, clear: null }
    if (bottom - y >= right - x)
      return up === 0
        ? { bounds: b, clear: null }
        : { bounds: { ...b, bottom: r }, clear: { ...b, top: r + 1 } }
    return back === 0
      ? { bounds: b, clear: null }
      : { bounds: { ...b, right: c }, clear: { ...b, left: c + 1 } }
  }
  if (Math.abs(outY) >= Math.abs(outX))
    return { bounds: outY > 0 ? { ...b, bottom: r } : { ...b, top: r }, clear: null }
  return { bounds: outX > 0 ? { ...b, right: c } : { ...b, left: c }, clear: null }
}

/**
 * How dragging from `b` to `t` fills: as the fill handle does on its own,
 * or with Ctrl / ⌘ held the other way, copying a run it would continue
 * and counting up a number it would copy.
 */
function fillMode(b: SheetBounds, t: SheetBounds, invert: boolean): SheetFillMode {
  if (!invert) return 'auto'
  const down = t.left === b.left && t.right === b.right
  const cells = sheet.value.cells
  const [first, last] = down ? [b.left, b.right] : [b.top, b.bottom]
  for (let line = first; line <= last; line++) {
    const values = down
      ? Array.from({ length: b.bottom - b.top + 1 }, (_, i) => valueOf(cells[b.top + i]?.[line]))
      : Array.from({ length: b.right - b.left + 1 }, (_, i) => valueOf(cells[line]?.[b.left + i]))
    if (fillContinues(values)) return 'copy'
  }
  return 'series'
}

/** Fills from the selection to `target`, or clears what was dragged back over. */
function finishFill(target: { bounds: SheetBounds; clear: SheetBounds | null }, invert: boolean) {
  const b = lastBounds()
  const t = target.bounds
  const same = t.top === b.top && t.bottom === b.bottom && t.left === b.left && t.right === b.right
  if (target.clear) {
    if (transact((tr) => tr.clearValues(target.clear!), { action: 'clear' }))
      announce(format(messages.value.cleared, { range: rangeName(target.clear) }))
  } else if (!same) {
    if (transact((tr) => tr.fill(b, t, { mode: fillMode(b, t, invert) }), { action: 'fill' }))
      announce(format(messages.value.filled, { range: rangeName(t) }))
  }
  const now = selection.value.active
  setSelection({
    active: inBounds(t, now.row, now.col) ? now : { row: t.top, col: t.left },
    ranges: [{ start: { row: t.top, col: t.left }, end: { row: t.bottom, col: t.right } }],
  })
}

const fillMeta = { action: 'fill' } as const

/** Fills down (or right) from the first row (or column) of the selection, as Ctrl+D and Ctrl+R do. */
function fillFromEdge(direction: 'down' | 'right') {
  const b = lastBounds()
  const source = direction === 'down' ? { ...b, bottom: b.top } : { ...b, right: b.left }
  if (direction === 'down' && b.bottom === b.top) {
    if (b.top === 0) return
    // one row: copies the row above
    source.top = source.bottom = b.top - 1
    return void transact(
      (tr) => tr.fill(source, { ...b, top: b.top - 1 }, { mode: 'copy' }),
      fillMeta,
    )
  }
  if (direction === 'right' && b.right === b.left) {
    if (b.left === 0) return
    source.left = source.right = b.left - 1
    return void transact(
      (tr) => tr.fill(source, { ...b, left: b.left - 1 }, { mode: 'copy' }),
      fillMeta,
    )
  }
  transact((tr) => tr.fill(source, b, { mode: 'copy' }), fillMeta)
}

/** Double-clicking the fill handle fills down as far as the column beside it has data. */
function fillDownToData() {
  const b = lastBounds()
  const cells = sheet.value.cells
  const beside = [b.left - 1, b.right + 1].find((c) => c >= 0 && !isBlank(cells[b.bottom + 1]?.[c]))
  if (beside == null) return
  let end = b.bottom + 1
  while (end + 1 < rowCount.value && !isBlank(cells[end + 1]?.[beside])) end++
  finishFill({ bounds: { ...b, bottom: end }, clear: null }, false)
}

// Rows and columns -----------------------------------------------------------------------

/** The rows (or columns) the last range covers. */
function linesOf(axis: SheetAxisName) {
  const b = lastBounds()
  return axis === 'row'
    ? { from: b.top, count: b.bottom - b.top + 1 }
    : { from: b.left, count: b.right - b.left + 1 }
}

function insertLines(axis: SheetAxisName, after: boolean) {
  const { from, count } = linesOf(axis)
  const at = after ? from + count : from
  const changed = transact(
    (tr) => (axis === 'row' ? tr.insertRows(at, count) : tr.insertCols(at, count)),
    { action: 'insert' },
  )
  // the selection stays where it was, on the new rows (or columns) when they went before it
  if (!changed) return
  announce(format(messages.value[axis === 'row' ? 'rowsInserted' : 'colsInserted'], { count }))
}

function deleteLines(axis: SheetAxisName) {
  const { from, count } = linesOf(axis)
  const changed = transact(
    (tr) => (axis === 'row' ? tr.deleteRows(from, count) : tr.deleteCols(from, count)),
    { action: 'delete' },
  )
  if (!changed) return
  const point = clampPoint(
    axis === 'row' ? { row: from, col: active.value.col } : { row: active.value.row, col: from },
    rowCount.value,
    colCount.value,
  )
  setSelection(selectCell(point))
  announce(format(messages.value[axis === 'row' ? 'rowsDeleted' : 'colsDeleted'], { count }))
}

/** Hides the selected rows (or columns), or shows the hidden ones among them. */
function setHidden(axis: SheetAxisName, hide: boolean) {
  const { from, count } = linesOf(axis)
  const axisNow = axis === 'row' ? rows.value : cols.value
  transact(
    (tr) => {
      for (let i = from; i < from + count; i++)
        if (hide) tr.setSize(axis, i, 0)
        else if (axisNow.hidden(i)) tr.setSize(axis, i, undefined)
    },
    { action: 'hide' },
  )
}

/** Whether any of the selected rows (or columns) is hidden, or right beside them. */
function hasHidden(axis: SheetAxisName) {
  const { from, count } = linesOf(axis)
  const axisNow = axis === 'row' ? rows.value : cols.value
  for (let i = Math.max(0, from - 1); i <= Math.min(axisNow.count - 1, from + count); i++)
    if (axisNow.hidden(i)) return true
  return false
}

/** Sets the size of a row (or column), and of every selected one when it is among them. */
function resizeLines(axis: SheetAxisName, index: number, size: number | undefined) {
  const b = lastBounds()
  const selected =
    whole(b, axis) &&
    (axis === 'row' ? index >= b.top && index <= b.bottom : index >= b.left && index <= b.right)
  const lines = selected
    ? axis === 'row'
      ? { from: b.top, to: b.bottom }
      : { from: b.left, to: b.right }
    : { from: index, to: index }
  const changed = transact(
    (tr) => {
      for (let i = lines.from; i <= lines.to; i++) tr.setSize(axis, i, size)
    },
    { action: 'resize' },
  )
  if (changed && size) announce(format(messages.value.resized, { size }))
}

let fitCanvas: CanvasRenderingContext2D | null | undefined

/** The width that fits the widest text in a column, or the height that fits a row's wrapped text. */
function fitSize(axis: SheetAxisName, index: number): number | undefined {
  const cells = sheet.value.cells
  const font = root.value ? getComputedStyle(root.value) : null
  if (axis === 'col') {
    fitCanvas ??= document.createElement('canvas').getContext('2d')
    if (!fitCanvas || !font) return undefined
    const plain = `${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`
    const bold = `${font.fontStyle} 600 ${font.fontSize} ${font.fontFamily}`
    let widest = 0
    for (const line of cells) {
      const input = line?.[index]
      if (isBlank(input)) continue
      const cell = cellOf(input)
      const style = cell?.style ? doc.value.styles?.[cell.style] : undefined
      fitCanvas.font = style?.bold ? bold : plain
      const text = formatValue(valueOf(input), cell?.format, lang.value)
      for (const part of text.split('\n'))
        widest = Math.max(widest, fitCanvas.measureText(part).width)
    }
    // the cell's padding and its grid line
    return widest ? Math.ceil(widest) + 18 : undefined
  }
  const line = cells[index]
  if (!line || !root.value) return undefined
  let tallest = 0
  const probe = document.createElement('div')
  probe.className = 'dou-sheet__probe'
  root.value.appendChild(probe)
  line.forEach((input, col) => {
    const cell = cellOf(input)
    if (isBlank(input) || !cell?.style || !doc.value.styles?.[cell.style]?.wrap) return
    probe.style.width = `${cols.value.size(col) - 16}px`
    probe.textContent = formatValue(cell.value, cell.format, lang.value)
    tallest = Math.max(tallest, probe.offsetHeight + 9)
  })
  probe.remove()
  return tallest > props.rowHeight ? Math.ceil(tallest) : undefined
}

/** Moves the selected rows (or columns) to before line `to`. */
function moveSelectedLines(axis: SheetAxisName, to: number) {
  const { from, count } = linesOf(axis)
  if (to >= from && to <= from + count) return
  const changed = transact(
    (tr) => (axis === 'row' ? tr.moveRows({ from, count }, to) : tr.moveCols({ from, count }, to)),
    { action: 'move' },
  )
  if (!changed) return
  const start = to > from ? to - count : to
  const b = lastBounds()
  const range: SheetRange =
    axis === 'row'
      ? { start: { row: start, col: b.left }, end: { row: start + count - 1, col: b.right } }
      : { start: { row: b.top, col: start }, end: { row: b.bottom, col: start + count - 1 } }
  setSelection({ active: range.start, ranges: [range] })
  announce(format(messages.value[axis === 'row' ? 'rowsMoved' : 'colsMoved'], { count }))
}

// Menu -----------------------------------------------------------------------------------

const menu = ref<InstanceType<typeof SheetMenu>>()
const menuOpen = ref(false)
const menuItems = shallowRef<SheetMenuItem[]>([])

/**
 * The menu's items: the clipboard, then what fits where it opened. Whole
 * rows (or columns) get only row (or column) operations; a cell gets both,
 * grouped into submenus to keep the menu short.
 */
function menuFor(area: SheetMenuContext['area']): SheetMenuItem[] {
  const m = messages.value
  const items: SheetMenuItem[] = [
    {
      key: 'cut',
      label: m.cut,
      icon: ScissorsIcon,
      shortcut: 'mod+x',
      disabled: props.readonly,
      run: () => void copyToClipboard(true),
    },
    {
      key: 'copy',
      label: m.copy,
      icon: CopyIcon,
      shortcut: 'mod+c',
      run: () => void copyToClipboard(false),
    },
    {
      key: 'paste',
      label: m.paste,
      icon: ClipboardPasteIcon,
      shortcut: 'mod+v',
      disabled: props.readonly,
      run: () => void pasteFromClipboard(),
    },
  ]
  if (props.readonly) return items.filter((item) => item.key === 'copy')
  const rowLines = linesOf('row')
  const colLines = linesOf('col')
  const insertRows: SheetMenuItem[] = [
    {
      key: 'row-above',
      icon: RowInsertTopIcon,
      label: format(m.insertRowsAbove, { count: rowLines.count }),
      run: () => insertLines('row', false),
    },
    {
      key: 'row-below',
      icon: RowInsertBottomIcon,
      label: format(m.insertRowsBelow, { count: rowLines.count }),
      run: () => insertLines('row', true),
    },
  ]
  const insertCols: SheetMenuItem[] = [
    {
      key: 'col-left',
      icon: ColumnInsertLeftIcon,
      label: format(m.insertColsLeft, { count: colLines.count }),
      run: () => insertLines('col', false),
    },
    {
      key: 'col-right',
      icon: ColumnInsertRightIcon,
      label: format(m.insertColsRight, { count: colLines.count }),
      run: () => insertLines('col', true),
    },
  ]
  // deleting every row (or column) would leave nothing: not offered
  const deleteRows: SheetMenuItem[] =
    rowLines.count >= rowCount.value
      ? []
      : [
          {
            key: 'row-delete',
            icon: RowRemoveIcon,
            label: format(m.deleteRows, { count: rowLines.count }),
            tone: 'danger',
            run: () => deleteLines('row'),
          },
        ]
  const deleteCols: SheetMenuItem[] =
    colLines.count >= colCount.value
      ? []
      : [
          {
            key: 'col-delete',
            icon: ColumnRemoveIcon,
            label: format(m.deleteCols, { count: colLines.count }),
            tone: 'danger',
            run: () => deleteLines('col'),
          },
        ]
  const visibility = (axis: SheetAxisName): SheetMenuItem[] => {
    const count = axis === 'row' ? rowLines.count : colLines.count
    const out: SheetMenuItem[] = [
      {
        key: `${axis}-hide`,
        icon: EyeOffIcon,
        label: format(m[axis === 'row' ? 'hideRows' : 'hideCols'], { count }),
        divided: true,
        run: () => setHidden(axis, true),
      },
    ]
    if (hasHidden(axis))
      out.push({
        key: `${axis}-show`,
        icon: EyeIcon,
        label: m[axis === 'row' ? 'showRows' : 'showCols'],
        run: () => setHidden(axis, false),
      })
    return out
  }
  const clear: SheetMenuItem = {
    key: 'clear',
    label: m.clear,
    icon: EraserIcon,
    shortcut: 'Delete',
    divided: true,
    run: clearSelection,
  }
  if (area === 'row' || area === 'col') {
    const lines = area === 'row' ? [...insertRows, ...deleteRows] : [...insertCols, ...deleteCols]
    return [...items, ...dividedFirst(lines), ...visibility(area), clear]
  }
  const remove = [...deleteRows, ...deleteCols]
  return [
    ...items,
    {
      key: 'insert',
      label: m.insert,
      icon: PlusIcon,
      divided: true,
      children: [...insertRows, ...dividedFirst(insertCols)],
    },
    ...(remove.length
      ? [
          {
            key: 'delete',
            label: m.delete,
            icon: TrashIcon,
            tone: 'danger',
            children: remove,
          } as const,
        ]
      : []),
    ...mergeItems(),
    clear,
  ]
}

/** Merging the selection, or splitting the merged cells in it. */
function mergeItems(): SheetMenuItem[] {
  const m = messages.value
  const b = lastBounds()
  const touched = merges.value.touching(b)
  const one = touched.length === 1 && sameBounds(touched[0]!, b)
  const out: SheetMenuItem[] = []
  if (!one && (b.top !== b.bottom || b.left !== b.right) && selection.value.ranges.length === 1)
    out.push({
      key: 'merge',
      label: m.mergeCells,
      icon: CellsMergeIcon,
      divided: true,
      run: mergeSelection,
    })
  if (touched.length)
    out.push({
      key: 'unmerge',
      label: m.unmergeCells,
      icon: CellsSplitIcon,
      divided: !out.length,
      run: unmergeSelection,
    })
  return out
}

const sameBounds = (a: SheetBounds, b: SheetBounds) =>
  a.top === b.top && a.left === b.left && a.bottom === b.bottom && a.right === b.right

/** Merges the last range of the selection into one cell. */
function mergeSelection() {
  const b = merges.value.expand(lastBounds())
  // the values only the top left one keeps
  let lost = 0
  for (let row = b.top; row <= b.bottom; row++)
    for (let col = b.left; col <= b.right; col++)
      if ((row !== b.top || col !== b.left) && !isBlank(sheet.value.cells[row]?.[col])) lost++
  const changed = transact((tr) => tr.mergeCells(b), { action: 'merge' })
  if (!changed) return
  setSelection(selectCell({ row: b.top, col: b.left }))
  const range = rangeName(b)
  if (lost) {
    const text = format(messages.value.mergedCleared, { range, count: lost })
    showNotice(text)
    announce(text)
  } else announce(format(messages.value.merged, { range }))
}

/** Splits the merged cells the last range of the selection touches. */
function unmergeSelection() {
  const b = lastBounds()
  if (transact((tr) => tr.unmergeCells(b), { action: 'merge' }))
    announce(format(messages.value.unmerged, { range: rangeName(b) }))
}

/** The items with a line above the first. */
const dividedFirst = (list: SheetMenuItem[]) =>
  list.map((item, i) => (i === 0 ? { ...item, divided: true } : item))

/** Where the menu opens: whole rows or columns selected count as their header. */
function menuArea(area: Hit['area']): SheetMenuContext['area'] {
  if (area !== 'cell') return area
  const b = lastBounds()
  if (selection.value.ranges.length === 1 && inBounds(b, active.value.row, active.value.col)) {
    const rowsAll = whole(b, 'row')
    const colsAll = whole(b, 'col')
    if (rowsAll && !colsAll) return 'row'
    if (colsAll && !rowsAll) return 'col'
    if (rowsAll && colsAll) return 'corner'
  }
  return 'cell'
}

function openMenu(at: Hit['area'], x: number, y: number) {
  const area = menuArea(at)
  const where = { area, selection: selection.value, sheet: sheetIndex.value }
  const own = menuFor(area)
  const added = resolved.value.menus.flatMap((items) => items(context, where))
  const items = added.length && own.length ? [...added, ...dividedFirst(own)] : [...added, ...own]
  menuItems.value = props.menu ? props.menu(items, where) : items
  if (menuItems.value.length) menu.value?.open(x, y)
}

function runMenuItem(key: unknown) {
  const find = (list: SheetMenuItem[]): SheetMenuItem | undefined => {
    for (const item of list) {
      if (item.key === key) return item
      const child = item.children && find(item.children)
      if (child) return child
    }
  }
  find(menuItems.value)?.run?.()
  if (lastPointer !== 'touch') focusGrid()
}

function onContextMenu(event: MouseEvent) {
  // the editor keeps the browser's menu, for its text
  if (editing.value) return
  event.preventDefault()
  // a long press opens the menu when the finger lifts
  if (lastPointer === 'touch') return
  openMenu(hitAt(event.clientX, event.clientY).area, event.clientX, event.clientY)
}

/** Opens the menu at the active cell, for the menu key and Shift+F10. */
function openMenuAtActive() {
  scrollToPoint(active.value)
  const rect = cellRect(active.value)
  const box = viewport.value!.getBoundingClientRect()
  openMenu('cell', box.left + rect.x + rect.width / 2, box.top + rect.y + rect.height)
}

// Pointer --------------------------------------------------------------------------------

interface Hit {
  area: 'cell' | 'col' | 'row' | 'corner'
  row: number
  col: number
  /** Where the point is in the sheet, past the headers and with scrolling, in px. */
  x: number
  y: number
}

/** What is under a point of the page; outside the grid, the nearest cell. */
function hitAt(clientX: number, clientY: number): Hit {
  const el = viewport.value!
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left - el.clientLeft
  const y = clientY - rect.top - el.clientTop
  const cx = x - headerWidth.value
  const cy = y - headerHeight.value
  const sx = cx < frozenWidth.value ? cx : cx + scroll.value.left
  const sy = cy < frozenHeight.value ? cy : cy + scroll.value.top
  const col = cols.value.indexAt(sx)
  const row = rows.value.indexAt(sy)
  const inCol = cx < 0
  const inRow = cy < 0
  return {
    area: inCol && inRow ? 'corner' : inRow ? 'col' : inCol ? 'row' : 'cell',
    row,
    col,
    x: sx,
    y: sy,
  }
}

/** How close to the edge between two headers a press resizes, in px. */
const EDGE_GRAB = { mouse: 4, touch: 10 }

/** The row (or column) whose far edge is at a point of the headers; `null` when none is. */
function edgeAt(hit: Hit, touch: boolean): { axis: SheetAxisName; index: number } | null {
  if (hit.area !== 'col' && hit.area !== 'row') return null
  const axis: SheetAxisName = hit.area
  const lines = axis === 'col' ? cols.value : rows.value
  const at = axis === 'col' ? hit.x : hit.y
  const index = axis === 'col' ? hit.col : hit.row
  const grab = EDGE_GRAB[touch ? 'touch' : 'mouse']
  if (Math.abs(lines.offset(index + 1) - at) <= grab) return { axis, index }
  if (index > 0 && Math.abs(at - lines.offset(index)) <= grab) return { axis, index: index - 1 }
  return null
}

/** Whether a header is one of the rows (or columns) selected end to end, which drag to move. */
function onSelectedLine(hit: Hit) {
  if (hit.area !== 'col' && hit.area !== 'row') return false
  if (selection.value.ranges.length !== 1) return false
  const b = lastBounds()
  const axis = hit.area
  return (
    whole(b, axis) &&
    (axis === 'col'
      ? hit.col >= b.left && hit.col <= b.right
      : hit.row >= b.top && hit.row <= b.bottom)
  )
}

interface Drag {
  pointerId: number
  mode: Hit['area'] | 'fill' | 'resize' | 'move'
  touch: boolean
  started: boolean
  /** Whether the drag changed anything, so a long press without it opens the menu. */
  moved: boolean
  x0: number
  y0: number
  clientX: number
  clientY: number
  /** Resizing: the line and its size when the press started. */
  axis?: SheetAxisName
  index?: number
  size0?: number
  /** Moving lines: where they would go. */
  to?: number
}

const drag = shallowRef<Drag | null>(null)
let hold: PointerHold | undefined
let pressTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0
/** A tap, kept from `pointerup` for the `click` that follows it. */
let tap: Hit | null = null
let lastPointer: string = 'mouse'
/** Whether the pointer rests on an edge between headers, for the cursor. */
const edgeHover = ref<SheetAxisName | null>(null)

const THRESHOLD = { mouse: 3, touch: 8 }
/** How long a finger rests on a cell before dragging selects, in ms. */
const LONG_PRESS = 400
/** How close to the edge a drag starts scrolling, in px. */
const EDGE = 32
const edgeSpeed = (gap: number) => (gap < EDGE ? Math.ceil(((EDGE - gap) / EDGE) * 20) : 0)

function startDrag(event: PointerEvent, init: Partial<Drag> & Pick<Drag, 'mode' | 'started'>) {
  drag.value = {
    pointerId: event.pointerId,
    touch: event.pointerType === 'touch',
    moved: false,
    x0: event.clientX,
    y0: event.clientY,
    clientX: event.clientX,
    clientY: event.clientY,
    ...init,
  }
  hold?.release()
  hold = holdPointer(event, root.value)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

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
    const inside =
      hit.area === 'corner' ||
      (hit.area === 'cell' && selectedBounds.value.some((b) => inBounds(b, hit.row, hit.col))) ||
      onSelectedLine(hit)
    if (!inside) press(hit, event)
    focusGrid()
    return
  }
  const edge = props.readonly ? null : edgeAt(hit, touch)
  if (edge) {
    // dragging the edge between two headers resizes the row (or column) before it
    event.preventDefault()
    const lines = edge.axis === 'col' ? cols.value : rows.value
    startDrag(event, { mode: 'resize', started: true, ...edge, size0: lines.size(edge.index) })
    hold?.grab()
    focusGrid()
    return
  }
  if (!touch) {
    // keeps the focus where it is and stops text from being selected
    event.preventDefault()
    focusGrid()
    if (
      !props.readonly &&
      onSelectedLine(hit) &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      // selected rows (or columns) move once dragged; a plain click still selects
      startDrag(event, { mode: 'move', started: false, axis: hit.area as SheetAxisName })
      return
    }
    press(hit, event)
  }
  startDrag(event, { mode: hit.area, started: !touch })
  if (touch) {
    pressTimer = setTimeout(() => {
      const d = drag.value
      if (!d || d.started) return
      d.started = true
      hold?.grab()
      navigator.vibrate?.(8)
      const at = hitAt(d.x0, d.y0)
      if (!props.readonly && onSelectedLine(at)) {
        // held on selected rows (or columns): dragging moves them
        d.mode = 'move'
        d.axis = at.area as SheetAxisName
      } else {
        // held still: select from here by dragging
        press(at, { shiftKey: false, ctrlKey: false, metaKey: false })
      }
      frame = requestAnimationFrame(autoScroll)
    }, LONG_PRESS)
  } else frame = requestAnimationFrame(autoScroll)
}

/** Pressing the fill handle starts filling at once, also with a finger. */
function onFillDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  lastPointer = event.pointerType
  const b = lastBounds()
  const hit = hitAt(event.clientX, event.clientY)
  fillGrab = {
    x: hit.x - cols.value.offset(b.right + 1),
    y: hit.y - rows.value.offset(b.bottom + 1),
  }
  fillAxis = null
  startDrag(event, { mode: 'fill', started: true })
  hold?.grab()
  fillTarget.value = null
  frame = requestAnimationFrame(autoScroll)
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
  if (d.mode === 'fill') fillInvert.value = event.ctrlKey || event.metaKey || event.altKey
  if (!d.started) {
    const far = Math.hypot(event.clientX - d.x0, event.clientY - d.y0)
    if (d.touch) {
      // a finger that moves before resting scrolls instead
      if (far > THRESHOLD.touch) stopDrag()
      return
    }
    if (far <= THRESHOLD.mouse) return
    d.started = true
    frame = requestAnimationFrame(autoScroll)
  }
  if (d.mode === 'resize') {
    const delta = d.axis === 'col' ? event.clientX - d.x0 : event.clientY - d.y0
    sizing.value = {
      axis: d.axis!,
      index: d.index!,
      size: Math.max(0, Math.round(d.size0! + delta)),
    }
    d.moved = true
    return
  }
  dragTo(hitAt(event.clientX, event.clientY))
}

/** Follows a drag to what is under the pointer. */
function dragTo(hit: Hit) {
  const d = drag.value!
  if (d.mode === 'corner' || d.mode === 'resize') return
  if (d.mode === 'fill') {
    fillTarget.value = fillTo(hit)
    d.moved = true
    return
  }
  if (d.mode === 'move') {
    // before the line under the pointer, or after it past its middle
    const axis = d.axis!
    const lines = axis === 'col' ? cols.value : rows.value
    const index = axis === 'col' ? hit.col : hit.row
    const at = axis === 'col' ? hit.x : hit.y
    const middle = lines.offset(index) + lines.size(index) / 2
    d.to = at < middle ? index : index + 1
    drag.value = { ...d }
    d.moved = true
    return
  }
  const sel = selection.value
  const last = sel.ranges[sel.ranges.length - 1]!
  const end =
    d.mode === 'col'
      ? { row: rowCount.value - 1, col: hit.col }
      : d.mode === 'row'
        ? { row: hit.row, col: colCount.value - 1 }
        : { row: hit.row, col: hit.col }
  if (end.row === last.end.row && end.col === last.end.col) return
  d.moved = true
  setSelection({
    active: sel.active,
    ranges: [...sel.ranges.slice(0, -1), { start: last.start, end }],
  })
}

/** Where lines being moved would go, as a line between headers. */
const moveMark = computed(() => {
  const d = drag.value
  if (d?.mode !== 'move' || !d.started || d.to == null) return null
  const { from, count } = linesOf(d.axis!)
  if (d.to >= from && d.to <= from + count) return null
  const b =
    d.axis === 'col'
      ? { top: 0, bottom: rowCount.value - 1, left: d.to, right: d.to }
      : { top: d.to, bottom: d.to, left: 0, right: colCount.value - 1 }
  const lines = d.axis === 'col' ? cols.value : rows.value
  if (d.to >= lines.count) {
    // past the last line: the far edge of the last one
    if (d.axis === 'col') b.left = b.right = lines.count - 1
    else b.top = b.bottom = lines.count - 1
  }
  const rect = rangeRect(b)
  if (!rect) return null
  const end = d.to >= lines.count
  return d.axis === 'col'
    ? { x: rect.x + (end ? rect.width : 0) - 1, y: 0, width: 2, height: viewHeight.value }
    : { x: 0, y: rect.y + (end ? rect.height : 0) - 1, width: viewWidth.value, height: 2 }
})

/** Where a row (or column) being resized ends, as a line across the grid. */
const sizeMark = computed(() => {
  const s = sizing.value
  if (!s) return null
  const b =
    s.axis === 'col'
      ? { top: 0, bottom: 0, left: s.index, right: s.index }
      : { top: 0, bottom: 0, left: 0, right: 0 }
  if (s.axis === 'col') {
    const rect = rangeRect(b)
    const right =
      headerWidth.value +
      cols.value.offset(s.index + 1) -
      (s.index >= frozen.value.cols ? scroll.value.left : 0)
    return rect || right > 0 ? { x: right - 1, y: 0, width: 1, height: viewHeight.value } : null
  }
  const bottom =
    headerHeight.value +
    rows.value.offset(s.index + 1) -
    (s.index >= frozen.value.rows ? scroll.value.top : 0)
  return { x: 0, y: bottom - 1, width: viewWidth.value, height: 1 }
})

function autoScroll() {
  const d = drag.value
  const el = viewport.value
  if (!d?.started || !el || d.mode === 'resize') return
  const rect = el.getBoundingClientRect()
  const left = rect.left + el.clientLeft + headerWidth.value + frozenWidth.value
  const top = rect.top + el.clientTop + headerHeight.value + frozenHeight.value
  const right = rect.left + el.clientLeft + el.clientWidth
  const bottom = rect.top + el.clientTop + el.clientHeight
  // a fill scrolls only the way it is going, not along an edge the finger passes near
  const across =
    d.mode === 'fill'
      ? fillAxis === 'col'
      : d.mode !== 'row' && !(d.mode === 'move' && d.axis === 'row')
  const along =
    d.mode === 'fill'
      ? fillAxis === 'row'
      : d.mode !== 'col' && !(d.mode === 'move' && d.axis === 'col')
  const dx = across ? edgeSpeed(right - d.clientX) || -edgeSpeed(d.clientX - left) : 0
  const dy = along ? edgeSpeed(bottom - d.clientY) || -edgeSpeed(d.clientY - top) : 0
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
  const invert = event.ctrlKey || event.metaKey || event.altKey
  stopDrag()
  switch (d.mode) {
    case 'resize': {
      const s = sizing.value
      sizing.value = null
      if (!s || !d.moved) return
      const base = s.axis === 'col' ? props.colWidth : props.rowHeight
      // dragged almost shut: hidden
      const size = s.size < 4 ? 0 : s.size
      resizeLines(s.axis, s.index, size === base ? undefined : size)
      return
    }
    case 'fill': {
      const target = fillTarget.value
      fillTarget.value = null
      if (target) finishFill(target, invert)
      return
    }
    case 'move':
      if (d.started && d.to != null) return moveSelectedLines(d.axis!, d.to)
      if (!d.touch) {
        // a click on a selected header selects just that one
        press(hitAt(d.x0, d.y0), { shiftKey: false, ctrlKey: false, metaKey: false })
        announceRange()
      }
      return
  }
  if (d.touch && !d.started) tap = hitAt(d.x0, d.y0)
  else if (d.touch && !d.moved) {
    // held without dragging: the menu, where the finger was
    openMenu(hitAt(d.x0, d.y0).area, d.x0, d.y0)
    return
  }
  if (d.started) announceRange()
}

function stopDrag() {
  clearTimeout(pressTimer)
  cancelAnimationFrame(frame)
  hold?.release()
  hold = undefined
  drag.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function onPointerCancel() {
  sizing.value = null
  fillTarget.value = null
  stopDrag()
}

/** The cursor over the edges between headers, which resize. */
function onHover(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || drag.value || props.readonly) return
  const edge = edgeAt(hitAt(event.clientX, event.clientY), false)
  edgeHover.value = edge?.axis ?? null
}

/** A tap selects a cell; a tap on the cell already selected edits it. */
function onClick(event: MouseEvent) {
  const touched = tap
  tap = null
  // a cell type's switch, such as a check box; a mouse selected its cell on the press
  const toggle = event.target instanceof Element && event.target.closest('[data-sheet-toggle]')
  const point = toggle && !event.shiftKey ? cellOfElement(toggle) : null
  if (point) {
    if (touched)
      press({ ...touched, ...point }, { shiftKey: false, ctrlKey: false, metaKey: false })
    toggleCells(point)
    focusGrid()
    return
  }
  const hit = touched
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
    editActive()
    return
  }
  press(hit, { shiftKey: false, ctrlKey: false, metaKey: false })
  focusGrid()
  announce(activeLabel.value)
}

/** The cell an element is drawn in, read from the grid's row and column numbers. */
function cellOfElement(el: Element): SheetPoint | null {
  const cell = el.closest('[role="gridcell"]')
  const row = cell?.parentElement?.getAttribute('aria-rowindex')
  const col = cell?.getAttribute('aria-colindex')
  if (!row || !col) return null
  const first = props.headers ? 2 : 1
  // a merged cell can be drawn in a row or column after its own
  return merges.value.anchor({ row: Number(row) - first, col: Number(col) - first })
}

function onDblClick(event: MouseEvent) {
  const hit = hitAt(event.clientX, event.clientY)
  const edge = props.readonly ? null : edgeAt(hit, lastPointer === 'touch')
  if (edge) return autofit(edge.axis, edge.index)
  if (lastPointer === 'touch' || hit.area !== 'cell') return
  // the click on a switch already switched it
  if (event.target instanceof Element && event.target.closest('[data-sheet-toggle]')) return
  select(selectCell({ row: hit.row, col: hit.col }))
  editActive()
}

/** Fits a row (or column), or every selected one when it is among them, to its contents. */
function autofit(axis: SheetAxisName, index: number) {
  const b = lastBounds()
  const selected =
    whole(b, axis) &&
    (axis === 'row' ? index >= b.top && index <= b.bottom : index >= b.left && index <= b.right)
  const [from, to] = selected
    ? axis === 'row'
      ? [b.top, b.bottom]
      : [b.left, b.right]
    : [index, index]
  transact(
    (tr) => {
      for (let i = from; i <= to; i++) tr.setSize(axis, i, fitSize(axis, i))
    },
    { action: 'resize' },
  )
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

// Extensions -----------------------------------------------------------------------------

/** Where a cell is drawn now, or `null` while it is out of view. */
function visibleRect(point: SheetPoint) {
  const rect = cellRect(point)
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width <= headerWidth.value ||
    rect.y + rect.height <= headerHeight.value ||
    rect.x >= viewWidth.value ||
    rect.y >= viewHeight.value
  )
    return null
  return rect
}

function forEachSelected(callback: (point: SheetPoint) => void) {
  const seen = new Set<string>()
  const m = merges.value
  for (const range of selection.value.ranges) {
    const b = boundsOf(range)
    const bottom = Math.min(b.bottom, rowCount.value - 1)
    const right = Math.min(b.right, colCount.value - 1)
    for (let row = b.top; row <= bottom; row++)
      for (let col = b.left; col <= right; col++) {
        const point = m.size ? m.anchor({ row, col }) : { row, col }
        const key = `${point.row}:${point.col}`
        if (seen.has(key)) continue
        seen.add(key)
        callback(point)
      }
  }
}

const context: SheetContext = {
  doc,
  sheetIndex,
  sheet,
  selection,
  active,
  readonly: computed(() => props.readonly),
  messages,
  forEachSelected,
  value: (point) => valueOf(sheet.value.cells[point.row]?.[point.col]),
  cellType: (point) => typeAt(point.row, point.col),
  cellRect: visibleRect,
  transact: (run, meta) => transact(run, meta),
  undo: () => travel('undo'),
  redo: () => travel('redo'),
  canUndo,
  canRedo,
  select: (target) => selectTarget(target),
  scrollTo: (target) => scrollToTarget(target),
  edit: (target) => editTarget(target),
  focus: () => focusGrid(),
  announce,
}
provide(sheetContextKey, context)

const keymaps = computed(() => resolved.value.keymaps.map((keymap) => keymap(context)))

let cleanups: (() => void)[] = []
function setupExtensions() {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  for (const setup of resolved.value.setups) {
    const cleanup = setup(context)
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  }
}
onMounted(() => {
  setupExtensions()
  watch(resolved, setupExtensions)
})
onBeforeUnmount(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
})

// Exposed --------------------------------------------------------------------------------

function toPoint(target: SheetCellTarget): SheetPoint | null {
  return typeof target === 'string' ? parseCell(target) : target
}

function selectTarget(target: string | SheetRange | SheetSelection) {
  let next: SheetSelection | null = null
  if (typeof target === 'string') {
    const range = parseRange(target)
    if (range) next = { active: range.start, ranges: [range] }
  } else if ('ranges' in target) next = target
  else next = { active: target.start, ranges: [target] }
  if (!next) return
  setSelection(clampSelection(next, rowCount.value, colCount.value))
  scrollToPoint(selection.value.active)
}

function scrollToTarget(target: SheetCellTarget) {
  const point = toPoint(target)
  if (point) scrollToPoint(clampPoint(point, rowCount.value, colCount.value))
}

function editTarget(target?: SheetCellTarget) {
  const point = target == null ? active.value : toPoint(target)
  if (!point) return
  select(selectCell(clampPoint(point, rowCount.value, colCount.value)))
  beginEdit('edit', editTextAt(active.value.row, active.value.col))
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
  select: selectTarget,
  scrollTo: scrollToTarget,
  edit: editTarget,
  focus: () => focusGrid(),
  copy: () => copyToClipboard(false),
  cut: () => copyToClipboard(true),
  paste: async (clip) => (clip ? paste(clip) : pasteFromClipboard()),
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
      'is-resizing-col': (drag?.mode === 'resize' && drag.axis === 'col') || edgeHover === 'col',
      'is-resizing-row': (drag?.mode === 'resize' && drag.axis === 'row') || edgeHover === 'row',
      'is-moving': drag?.mode === 'move' && drag.started,
    }"
    @keydown="onKeydown"
    @copy="onCopy"
    @cut="onCut"
    @paste="onPaste"
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
      @contextmenu="onContextMenu"
      @pointermove="onHover"
      @pointerleave="edgeHover = null"
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
              'is-after-hidden': col > 0 && cols.hidden(col - 1),
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
              'is-after-hidden': col > 0 && cols.hidden(col - 1),
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
          v-memo="[sheet.cells[row], memoBase, rowMarks(row), mergeKey(row)]"
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
              'is-after-hidden': row > 0 && rows.hidden(row - 1),
            }"
            role="rowheader"
            :style="`width:${headerWidth}px`"
          >
            {{ row + 1 }}
          </div>
          <div
            v-for="cell in rowCells(row, frozenColList)"
            :id="cell.id"
            :key="cell.key ?? cell.col"
            :class="[cell.cls, 'is-frozen']"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :aria-hidden="cell.hidden || undefined"
            :aria-rowspan="cell.rowspan"
            :aria-colspan="cell.colspan"
            :style="cell.css"
          >
            <template v-if="cell.render">
              <component :is="cell.render" v-bind="cell.props" />
              <span class="dou-sheet__sr-only">{{ cell.label }}</span>
            </template>
            <span v-else class="dou-sheet__text">{{ cell.text }}</span>
          </div>
          <div
            v-for="cell in rowCells(row, bodyCols)"
            :id="cell.id"
            :key="cell.key ?? cell.col"
            :class="cell.cls"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :aria-hidden="cell.hidden || undefined"
            :aria-rowspan="cell.rowspan"
            :aria-colspan="cell.colspan"
            :style="cell.css"
          >
            <template v-if="cell.render">
              <component :is="cell.render" v-bind="cell.props" />
              <span class="dou-sheet__sr-only">{{ cell.label }}</span>
            </template>
            <span v-else class="dou-sheet__text">{{ cell.text }}</span>
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
          v-memo="[sheet.cells[row], memoBase, rowMarks(row), mergeKey(row)]"
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
              'is-after-hidden': row > 0 && rows.hidden(row - 1),
            }"
            role="rowheader"
            :style="`width:${headerWidth}px`"
          >
            {{ row + 1 }}
          </div>
          <div
            v-for="cell in rowCells(row, frozenColList)"
            :id="cell.id"
            :key="cell.key ?? cell.col"
            :class="[cell.cls, 'is-frozen']"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :aria-hidden="cell.hidden || undefined"
            :aria-rowspan="cell.rowspan"
            :aria-colspan="cell.colspan"
            :style="cell.css"
          >
            <template v-if="cell.render">
              <component :is="cell.render" v-bind="cell.props" />
              <span class="dou-sheet__sr-only">{{ cell.label }}</span>
            </template>
            <span v-else class="dou-sheet__text">{{ cell.text }}</span>
          </div>
          <div
            v-for="cell in rowCells(row, bodyCols)"
            :id="cell.id"
            :key="cell.key ?? cell.col"
            :class="cell.cls"
            role="gridcell"
            :aria-colindex="cell.col + (headers ? 2 : 1)"
            :aria-selected="cell.cls.includes('is-selected') || undefined"
            :aria-hidden="cell.hidden || undefined"
            :aria-rowspan="cell.rowspan"
            :aria-colspan="cell.colspan"
            :style="cell.css"
          >
            <template v-if="cell.render">
              <component :is="cell.render" v-bind="cell.props" />
              <span class="dou-sheet__sr-only">{{ cell.label }}</span>
            </template>
            <span v-else class="dou-sheet__text">{{ cell.text }}</span>
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
      :aria-expanded="panelType ? true : undefined"
      :inputmode="panelType && editByTouch ? 'none' : undefined"
      :aria-activedescendant="panel?.activeId ?? undefined"
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
    <div
      v-if="clipRect"
      class="dou-sheet__mark"
      :class="{ 'is-cut': clipMark?.cut }"
      :style="rectStyle(clipRect)"
      aria-hidden="true"
    />
    <div
      v-if="fillPreview"
      class="dou-sheet__mark is-fill"
      :style="rectStyle(fillPreview)"
      aria-hidden="true"
    />
    <div
      v-if="fillClearRect"
      class="dou-sheet__clearing"
      :style="rectStyle(fillClearRect)"
      aria-hidden="true"
    />
    <div
      v-if="moveMark"
      class="dou-sheet__guide"
      :style="`left:${moveMark.x}px;top:${moveMark.y}px;width:${moveMark.width}px;height:${moveMark.height}px`"
      aria-hidden="true"
    />
    <div
      v-if="sizeMark"
      class="dou-sheet__guide is-thin"
      :style="`left:${sizeMark.x}px;top:${sizeMark.y}px;width:${sizeMark.width}px;height:${sizeMark.height}px`"
      aria-hidden="true"
    />
    <div
      v-if="fillRect"
      class="dou-sheet__fill"
      :class="{ 'is-dragging': fillTarget }"
      :style="`left:${fillRect.x}px;top:${fillRect.y}px`"
      :title="messages.fillHandle"
      aria-hidden="true"
      @pointerdown="onFillDown"
      @dblclick.stop="fillDownToData"
    />
    <div
      v-if="fillHint"
      class="dou-sheet__fill-hint"
      :class="{ 'is-flipped': fillHint.flip }"
      :style="`left:${fillHint.x}px;top:${fillHint.y}px`"
      aria-hidden="true"
    >
      {{ fillHint.text }}
    </div>
    <button
      v-if="panelButton"
      type="button"
      class="dou-sheet__panel-button"
      :style="`left:${panelButton.x}px;top:${panelButton.y}px`"
      :aria-label="messages.openPanel"
      tabindex="-1"
      @pointerdown.stop.prevent
      @click="openPanel"
    >
      <ChevronDownIcon />
    </button>
    <CellPanel
      v-if="panelType"
      ref="panel"
      :resolved="panelType"
      :value="editValue"
      :text="editText"
      :typed="editTyped"
      :anchor="editor"
      @pick="pickValue"
    />
    <component :is="overlay" v-for="(overlay, i) in resolved.overlays" :key="i" />
    <div v-if="notice" class="dou-sheet__notice" role="status">{{ notice }}</div>
    <SheetMenu ref="menu" v-model:open="menuOpen" :items="menuItems" @select="runMenuItem" />
    <span :id="keysHint" class="dou-sheet__sr-only">{{ messages.keys }}</span>
    <div class="dou-sheet__sr-only" aria-live="polite">{{ live }}</div>
  </div>
</template>
