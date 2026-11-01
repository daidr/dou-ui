<script setup lang="ts">
import {
  DouPopover,
  holdPointer,
  isComposing,
  matchesHotkey,
  useLocale,
  useElementSize,
  type PointerHold,
  type VirtualElement,
} from 'dou-ui'
import {
  ChevronDownIcon,
  ClipboardPasteIcon,
  ColumnGroupIcon,
  ColumnInsertLeftIcon,
  ColumnInsertRightIcon,
  ColumnRemoveIcon,
  ColumnUngroupIcon,
  CopyIcon,
  EraserIcon,
  MessagePlusIcon,
  MessageTextIcon,
  MessageXIcon,
  EyeIcon,
  EyeOffIcon,
  CellsMergeIcon,
  FilterIcon,
  FilterXIcon,
  FoldVerticalIcon,
  PlusIcon,
  RowGroupIcon,
  RowInsertBottomIcon,
  RowInsertTopIcon,
  RowRemoveIcon,
  RowUngroupIcon,
  ScissorsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SortIcon,
  CellsSplitIcon,
  TrashIcon,
  UnfoldVerticalIcon,
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
  splitSheet,
  type SheetBounds,
  type SheetCellTarget,
  type SheetPoint,
  type SheetRange,
} from './core/address'
import { formatClip, parseClip, type SheetClip } from './core/clipboard'
import { fillContinues, type SheetFillMode } from './core/fill'
import { SheetAxis } from './core/axis'
import { mergesOf, type SheetMerges } from './core/merge'
import { groupRange, groupsOf, SheetGroups, OUTLINE_LANE, type SheetGroupLines } from './core/group'
import SheetNote from './components/sheet-note.vue'
import SheetOutline from './components/sheet-outline.vue'
import { alignOf, fitNumber, formatValue, inputText, parseInput } from './core/format'
import { SheetHistory, type SheetHistoryView } from './core/history'
import { SheetFormulaEngine } from './formula/engine'
import {
  callAt,
  canPointAt,
  formulaParts,
  formulaReferences,
  nameAt,
  partClass,
} from './formula/edit'
import type { SheetFunction } from './formula/functions'
import { isSheetError, type SheetErrorCode } from './formula/error'
import { shownValue } from './formula/values'
import {
  cellOf,
  colCountOf,
  compactCell,
  isBlank,
  rowCountOf,
  valueOf,
  type SheetCellInput,
  type SheetData,
  type SheetFilterRule,
  type SheetSortOrder,
  type SheetStyle,
  type SheetTypeSetup,
  type SheetValue,
} from './core/model'
import { movePoint, stepIndex, type SheetDirection } from './core/nav'
import { compareForSort, isEmptyValue, meetsRule, textCollator } from './core/data'
import { layStyle, SheetLooks, type SheetLook } from './core/conditional'
import FilterPanel from './components/filter-panel.vue'
import {
  clampPoint,
  clampSelection,
  sameSelection,
  selectCell,
  type SheetSelection,
} from './core/selection'
import {
  movedIndex,
  SheetTransaction,
  sheetKey,
  type SheetAxisName,
  type SheetRef,
  type SheetStylePatch,
  type SheetTransactionMeta,
} from './core/transaction'
import SheetMenu from './components/sheet-menu.vue'
import CellPanel from './components/cell-panel.vue'
import { builtinCellTypes } from './cell-types'
import { sheetContextKey, type SheetContext, type SheetEditInputOptions } from './context'
import { resolveCellType, type SheetCellType, type SheetResolvedType } from './core/cell-type'
import { ruleMessage, SheetChecks } from './core/validation'
import {
  resolveSheetExtensions,
  type ResolvedSheetExtensions,
  type SheetHistoryHandler,
} from './core/extension'
import { format, useSheetMessages } from './locale'
import { sheetToCSV, type SheetCSVWriteOptions } from './core/csv'
import { createSheetExport, type SheetExportTarget } from './export'
import type {
  SheetEmits,
  SheetSlots,
  SheetExpose,
  SheetInvalidCell,
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
  outline: true,
  gridlines: true,
  historyDepth: 100,
  ariaLabel: undefined,
  messages: undefined,
  menu: undefined,
  extensions: () => [],
})
const emit = defineEmits<SheetEmits>()
defineSlots<SheetSlots>()

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
    if (engine.doc !== value) engine.load(value)
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

// Formulas -------------------------------------------------------------------------------

const newEngine = () =>
  new SheetFormulaEngine(doc.value, { functions: resolved.value.functions, locale: lang.value })
/** Works out the formulas of the workbook as cells show them, and follows every change. */
let engine = newEngine()
/** Goes up when the engine is made again, for other functions or another language. */
const engineId = shallowRef(0)
watch([() => resolved.value.functions, lang], () => {
  engine = newEngine()
  engineId.value++
})
/** A cell of the sheet shown as it comes to: its formula's result, or its value. */
const resultAt = (row: number, col: number) => engine.result(sheetKey(sheet.value), row, col)
/** What a cell of the sheet shown comes to: its formula's result, or its value. */
const valueAt = (row: number, col: number) =>
  shownValue(valueOf(sheet.value.cells[row]?.[col]), resultAt, row, col)
/** What a cell of any sheet comes to. */
function valueIn(data: SheetData) {
  if (data === sheet.value) return valueAt
  const key = sheetKey(data)
  const result = (row: number, col: number) => engine.result(key, row, col)
  return (row: number, col: number) => shownValue(valueOf(data.cells[row]?.[col]), result, row, col)
}

// Conditional formats ------------------------------------------------------------------------

/**
 * The looks the conditional formats of the sheet shown give its cells,
 * worked out again after every change: a rule can depend on any cell.
 */
const looks = computed<SheetLooks>((previous) => {
  // results change with any cell of the workbook
  void doc.value
  void engineId.value
  return looksOf(sheet.value, previous)
})
/** The looks the conditional formats of a sheet give its cells. */
function looksOf(data: SheetData, previous?: SheetLooks) {
  const key = sheetKey(data)
  return new SheetLooks(
    data.conditionalFormats,
    {
      valueAt: valueIn(data),
      textAt: (row, col) => cellText(data.cells[row]?.[col], { sheet: key, row, col }),
      evaluate: (formula) => engine.evaluate(formula, key),
      // a large range is read again only when one of its cells changed
      cellStamp: (row, col) => {
        const input = data.cells[row]?.[col]
        const value = valueOf(input)
        return typeof value === 'string' && value.startsWith('=')
          ? engine.result(key, row, col)
          : input
      },
      styles: doc.value.styles,
      size: { rows: rowCountOf(data), cols: colCountOf(data) },
      lang: lang.value,
    },
    previous,
  )
}
/** What a row's conditional looks are, for `v-memo`: rules can look past the row. */
function looksKey(row: number) {
  const l = looks.value
  if (l.empty) return ''
  let key = ''
  for (const [left, right] of l.spansIn(row))
    for (const list of [frozenColList.value, bodyCols.value])
      for (const col of list)
        if (col >= left && col <= right) key += `${col}:${l.lookAt(row, col)?.key ?? ''};`
  return key
}
/** Compiled styles of cells with a conditional look, by the cell's style and the look. */
const lookStyles = computed(() => {
  void styleCache.value
  return new Map<string, ReturnType<typeof compileStyle>>()
})
function lookStyle(name: string | undefined, look: SheetLook) {
  const key = `${name ?? ''}\u0000${look.key}`
  let compiled = lookStyles.value.get(key)
  if (!compiled) {
    const own = name ? doc.value.styles?.[name] : undefined
    compiled = compileStyle(look.style ? layStyle(own, look.style) : (own ?? {}))
    lookStyles.value.set(key, compiled)
  }
  return compiled
}
/** The CSS that draws a look's bar. */
const barCss = (bar: NonNullable<SheetLook['bar']>) =>
  `--dou-sheet-bar-from:${(bar.from * 100).toFixed(2)}%;--dou-sheet-bar-to:${(bar.to * 100).toFixed(2)}%;--dou-sheet-bar-color:${bar.color};`

// Data validation --------------------------------------------------------------------------

/** The rules of a sheet, reading its cells as they come to. */
function checksOf(data: SheetData) {
  const key = sheetKey(data)
  const result = (row: number, col: number) => engine.result(key, row, col)
  return new SheetChecks(data.validations, {
    valueAt: (row, col) => shownValue(valueOf(data.cells[row]?.[col]), result, row, col),
    textAt: (row, col) => cellText(data.cells[row]?.[col], { sheet: key, row, col }),
    evaluate: (formula) => engine.evaluate(formula, key),
    listAt: (reference) => listValues(reference, data),
    size: { rows: rowCountOf(data), cols: colCountOf(data) },
    lang: lang.value,
  })
}
/** The rules of the sheet shown, made again after every change: a list or formula can read any cell. */
const checks = computed(() => {
  void doc.value
  void engineId.value
  return checksOf(sheet.value)
})
/** What a row's marks depend on beyond its own cells, for `v-memo`. */
function checksKey(row: number) {
  const c = checks.value
  return c.empty || !c.readsOthersIn(row) ? 0 : c
}

/** The cells whose values break a rule, on every sheet or on one. */
function findInvalid(target?: SheetRef): SheetInvalidCell[] {
  const found: SheetInvalidCell[] = []
  const at = target == null ? -1 : indexOfSheet(target)
  doc.value.sheets.forEach((data, index) => {
    if ((target != null && index !== at) || !data.validations?.length) return
    const list = [...checksOf(data).broken()]
    list.sort((a, b) => a.row - b.row || a.col - b.col)
    for (const { row, col, rule } of list)
      found.push({
        sheet: data.name,
        cell: formatCell({ row, col }),
        rule,
        message: ruleMessage(rule, messages.value),
      })
  })
  return found
}

/** The values of the cells a list refers to, such as `'=$H$2:$H$9'` or `'=城市!A2:A20'`. */
function listValues(reference: string, from: SheetData): SheetValue[] {
  const { sheet: name, ref: cells } = splitSheet(reference.replace(/^=/, '').trim())
  const data = name == null ? from : doc.value.sheets.find((s) => s.name === name)
  const range = data && parseRange(cells)
  if (!data || !range) return []
  const key = sheetKey(data)
  const result = (row: number, col: number) => engine.result(key, row, col)
  const b = boundsOf(range)
  const bottom = Math.min(b.bottom, rowCountOf(data) - 1, b.top + 999)
  const right = Math.min(b.right, colCountOf(data) - 1)
  const values: SheetValue[] = []
  for (let row = b.top; row <= bottom; row++)
    for (let col = b.left; col <= right; col++) {
      const value = shownValue(valueOf(data.cells[row]?.[col]), result, row, col)
      if (!isSheetError(value)) values.push(value as SheetValue)
    }
  return values
}

/**
 * The select type for the cells of a list rule: plain text, as typed, or
 * soft tags when an option has a tone. A rule's own check marks values
 * that aren't options, so the type's is left out.
 */
const listTypes = computed(() => {
  const picker = cellTypes.value.get('select')
  return (
    picker && {
      plain: { ...picker, render: undefined, valid: undefined } as SheetCellType,
      tagged: { ...picker, valid: undefined } as SheetCellType,
    }
  )
})
const listSetups = new WeakMap<object, SheetResolvedType>()
function listTypeAt(
  row: number,
  col: number,
  c: SheetChecks = checks.value,
): SheetResolvedType | undefined {
  const types = listTypes.value
  if (c.empty || !types) return undefined
  const options = c.optionsAt(row, col)
  if (!options) return undefined
  let listed = listSetups.get(options)
  if (!listed) {
    const toned = options.some((o) => typeof o === 'object' && o != null && 'tone' in o && o.tone)
    listed = {
      name: 'select',
      definition: toned ? types.tagged : types.plain,
      setup: { type: 'select', options, plain: !toned },
    }
    listSetups.set(options, listed)
  }
  return listed
}

// Filtering --------------------------------------------------------------------------------

/** The filter's range on the sheet shown, kept inside it. */
const filterBounds = computed(() => filterBoundsOf(sheet.value))
/** A sheet's filter range, kept inside it. */
function filterBoundsOf(data: SheetData) {
  const range = data.filter && parseRange(data.filter.range)
  if (!range) return null
  const b = boundsOf(range)
  const bottom = Math.min(b.bottom, rowCountOf(data) - 1)
  const right = Math.min(b.right, colCountOf(data) - 1)
  return b.top > bottom || b.left > right ? null : { ...b, bottom, right }
}

/**
 * The rows of the filter's range that its rules hide, but for column
 * `skip`'s rule; on the sheet shown, or on `data`.
 */
function rowsFilteredOut(skip?: number, data = sheet.value) {
  const out = new Set<number>()
  const f = data.filter
  const b = data === sheet.value ? filterBounds.value : filterBoundsOf(data)
  if (!f?.columns || !b) return out
  const collator = textCollator(lang.value)
  const rules = Object.entries(f.columns)
    .map(([key, rule]) => ({ col: Number(key), rule }))
    .filter(({ col }) => col !== skip && col >= b.left && col <= b.right)
  if (!rules.length) return out
  const { cells } = data
  const valueOfCell = valueIn(data)
  const key = sheetKey(data)
  for (let row = b.top + 1; row <= b.bottom; row++) {
    for (const { col, rule } of rules) {
      const value = valueOfCell(row, col)
      const text = isEmptyValue(value) ? '' : cellText(cells[row]?.[col], { sheet: key, row, col })
      if (!meetsRule(rule, value, text, collator)) {
        out.add(row)
        break
      }
    }
  }
  return out
}

/*
 * The rows the filter hides. Worked out when the filter changes, not on
 * every edit: a row that stops matching while being edited stays shown
 * until the filter is applied again, so it doesn't vanish under the cursor.
 */
const filteredRows = shallowRef<ReadonlySet<number>>(new Set())
/** What the filter says, on which sheet, with which engine: changes only when one of them does. */
const filterKey = computed(
  () => `${sheetIndex.value}:${engineId.value}:${JSON.stringify(sheet.value.filter ?? null)}`,
)
watch(filterKey, () => (filteredRows.value = rowsFilteredOut()), {
  immediate: true,
  // at once, so what a change of the filter shows can be read out right after it
  flush: 'sync',
})
/**
 * Groups folded on a read-only grid: there they fold for this view alone,
 * by sheet and range, and the data stays as it is.
 */
const viewFolds = shallowRef<ReadonlyMap<string, boolean>>(new Map())
watch(
  () => props.readonly,
  () => (viewFolds.value = new Map()),
)
const foldKey = (data: SheetData, range: string) => `${sheetKey(data)}\u0000${range}`

/** A sheet's groups as shown, with the folds of a read-only view. */
function shownGroupsOf(data: SheetData) {
  const folds = viewFolds.value
  if (!folds.size || !data.groups?.length) return groupsOf(data)
  return new SheetGroups(data.groups, (g) => folds.get(foldKey(data, g.range)) ?? !!g.collapsed)
}
const groups = computed(() => shownGroupsOf(sheet.value))

/** Sizes with every line of `hidden` at 0. */
function hideIn(sizes: Record<number, number>, ...hidden: ReadonlySet<number>[]) {
  if (hidden.every((set) => !set.size)) return sizes
  const out: Record<number, number> = { ...sizes }
  for (const set of hidden) for (const line of set) out[line] = 0
  return out
}

/** The row heights drawn: the sheet's, and 0 for the rows a filter or a folded group hides. */
const shownRowSizes = computed(() =>
  hideIn(sheet.value.rowSizes ?? NO_SIZES, filteredRows.value, groups.value.rows.hidden),
)
/** The column widths drawn: the sheet's, and 0 for the columns of folded groups. */
const shownColSizes = computed(() =>
  hideIn(sheet.value.colSizes ?? NO_SIZES, groups.value.cols.hidden),
)

/** The filter buttons on the headings shown: one per column of the range. */
const filterButtons = computed(() => {
  const b = filterBounds.value
  const f = sheet.value.filter
  if (!b || !f) return []
  const out: {
    col: number
    x: number
    y: number
    active: boolean
    sorted?: SheetSortOrder
    label: string
  }[] = []
  for (let col = b.left; col <= b.right; col++) {
    if (cols.value.hidden(col)) continue
    const rect = visibleRect({ row: b.top, col })
    if (!rect || rect.x + rect.width - 22 < headerWidth.value) continue
    const heading =
      cellText(sheet.value.cells[b.top]?.[col], { row: b.top, col }) || columnName(col)
    out.push({
      col,
      // a heading cut off by the view's edge has its button at the edge
      x: Math.min(rect.x + rect.width, viewWidth.value),
      y: rect.y + rect.height / 2,
      active: !!f.columns?.[col],
      sorted: f.sorted?.col === col ? f.sorted.order : undefined,
      label: format(messages.value.filter.button, { column: heading }),
    })
  }
  return out
})

/** The column whose filter panel is open. */
const filterOpen = ref<number | null>(null)
// Escape hands focus back to the filter button, which is out of the tab
// order; send it on to the grid so arrow keys and Alt+↓ go on working.
watch(filterOpen, (now) => {
  if (now != null) return
  void nextTick(() => {
    if (
      (document.activeElement as HTMLElement | null)?.classList.contains('dou-sheet__filter-button')
    )
      focusGrid()
  })
})

/**
 * A column's values as they show, each once, in sorted order, from the rows
 * the other columns keep; and whether most of them are numbers.
 */
const filterValues = computed(() => {
  const col = filterOpen.value
  const b = filterBounds.value
  if (col == null || !b) return { values: [] as string[], numeric: false }
  const others = rowsFilteredOut(col)
  let numbers = 0
  let filled = 0
  const seen = new Map<string, unknown>()
  const cells = sheet.value.cells
  for (let row = b.top + 1; row <= b.bottom; row++) {
    if (others.has(row) || sheet.value.rowSizes?.[row] === 0) continue
    const value = valueAt(row, col)
    const empty = isEmptyValue(value)
    if (!empty) filled++
    if (typeof value === 'number') numbers++
    const text = empty ? '' : cellText(cells[row]?.[col], { row, col })
    if (!seen.has(text)) seen.set(text, value)
  }
  const collator = textCollator(lang.value)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const values = [...seen.keys()].sort((x, y) => {
    if (!x || !y) return x ? -1 : y ? 1 : 0
    return compareForSort(seen.get(x), seen.get(y), collator)
  })
  return { values, numeric: filled > 0 && numbers * 2 > filled }
})

function filterHeading(col: number) {
  const b = filterBounds.value
  if (!b) return columnName(col)
  return cellText(sheet.value.cells[b.top]?.[col], { row: b.top, col }) || columnName(col)
}

/** Sets a column's filter rule and says how many rows show now. */
function applyFilter(col: number, rule: SheetFilterRule | undefined) {
  filterOpen.value = null
  transact((tr) => tr.filterColumn(col, rule), { action: 'filter' })
  const b = filterBounds.value
  if (!b) return
  const total = b.bottom - b.top
  announce(
    format(messages.value.filter.applied, {
      column: filterHeading(col),
      shown: total - filteredRows.value.size,
      total,
    }),
  )
  focusGrid()
}

/**
 * Sorts rows: `range` by column `col`, the heading row kept in place when
 * `header`. Ranges with merged cells are not sorted.
 */
function sortBy(range: SheetBounds, col: number, order: SheetSortOrder, header: boolean) {
  const m = messages.value.filter
  if (merges.value.touching({ ...range, top: range.top + (header ? 1 : 0) }).length) {
    announce(m.mergedSort)
    showNotice(m.mergedSort)
    return false
  }
  const inFilter = sheet.value.filter && filterBounds.value && sameBounds(filterBounds.value, range)
  transact(
    (tr) => {
      tr.sortRange(range, [{ col, order }], { header, valueAt, lang: lang.value })
      if (inFilter) tr.markSorted({ col, order })
    },
    { action: 'sort' },
  )
  const heading = header
    ? cellText(sheet.value.cells[range.top]?.[col], { row: range.top, col })
    : ''
  announce(format(m.sorted, { column: heading || columnName(col) }))
  return true
}

function sortFilterColumn(col: number, order: SheetSortOrder) {
  filterOpen.value = null
  const b = filterBounds.value
  if (b) sortBy(b, col, order, true)
  focusGrid()
}

/**
 * The block of filled cells around a cell, as far as filled cells reach in
 * every direction; where sorting and filtering go when one cell is selected.
 */
function regionAround(point: SheetPoint): SheetBounds {
  const cells = sheet.value.cells
  const filled = (row: number, col: number) => !isBlank(cells[row]?.[col])
  const b = { top: point.row, left: point.col, bottom: point.row, right: point.col }
  const lastRow = rowCount.value - 1
  const lastCol = colCount.value - 1
  const rowHas = (row: number) => {
    for (let col = Math.max(0, b.left - 1); col <= Math.min(lastCol, b.right + 1); col++)
      if (filled(row, col)) return true
    return false
  }
  const colHas = (col: number) => {
    for (let row = Math.max(0, b.top - 1); row <= Math.min(lastRow, b.bottom + 1); row++)
      if (filled(row, col)) return true
    return false
  }
  let grew = true
  while (grew) {
    grew = false
    if (b.top > 0 && rowHas(b.top - 1)) {
      b.top--
      grew = true
    }
    if (b.bottom < lastRow && rowHas(b.bottom + 1)) {
      b.bottom++
      grew = true
    }
    if (b.left > 0 && colHas(b.left - 1)) {
      b.left--
      grew = true
    }
    if (b.right < lastCol && colHas(b.right + 1)) {
      b.right++
      grew = true
    }
  }
  return b
}

/** Whether a block's first row reads as headings: all text, over a row with something else. */
function hasHeadings(b: SheetBounds) {
  if (b.bottom - b.top < 1) return false
  let other = false
  for (let col = b.left; col <= b.right; col++) {
    const head = valueAt(b.top, col)
    if (typeof head !== 'string' || head === '') return false
    const below = valueAt(b.top + 1, col)
    if (typeof below !== 'string') other = true
  }
  return other
}

/**
 * Sorts by the active cell's column: the selected rows when more than one
 * is selected, else the filter's rows, else the block of cells around it.
 */
function sortSelection(order: SheetSortOrder) {
  const { col } = active.value
  const sel = lastBounds()
  if (sel.bottom > sel.top) return sortBy(sel, col, order, false)
  const f = filterBounds.value
  if (f && inBounds(f, active.value.row, col)) return sortBy(f, col, order, true)
  const region = regionAround(active.value)
  if (region.bottom === region.top) {
    announce(messages.value.filter.nothingToSort)
    showNotice(messages.value.filter.nothingToSort)
    return false
  }
  return sortBy(region, col, order, hasHeadings(region))
}

/** Puts a filter on the selection (or the block around the active cell), or takes it off. */
function toggleFilter() {
  const m = messages.value.filter
  if (sheet.value.filter) {
    filterOpen.value = null
    transact((tr) => tr.setFilter(null), { action: 'filter' })
    announce(m.removed)
    return
  }
  const sel = lastBounds()
  const b = sel.bottom > sel.top ? sel : regionAround(active.value)
  transact((tr) => tr.setFilter(b), { action: 'filter' })
  announce(format(m.added, { range: rangeName(b) }))
}

/** Clears every column's filter rule, showing all the rows again. */
function clearFilters() {
  const f = sheet.value.filter
  if (!f?.columns) return
  transact(
    (tr) => {
      for (const key of Object.keys(f.columns!)) tr.filterColumn(Number(key), undefined)
    },
    { action: 'filter' },
  )
  announce(messages.value.filter.removed)
}

/** Opens the filter panel of the active cell's column, from its heading. */
function openFilterAtActive() {
  const b = filterBounds.value
  const { row, col } = active.value
  if (!b || row !== b.top || col < b.left || col > b.right) return false
  filterOpen.value = col
  return true
}
/** When a row's results last changed, for `v-memo`. */
const resultsOf = (row: number) => engine.rowVersion(sheetKey(sheet.value), row)
/** The type of a cell of the sheet shown; a cell with a list rule and no type of its own picks from the list. */
function typeAt(row: number, col: number): SheetResolvedType | undefined {
  const input = sheet.value.cells[row]?.[col]
  if (input != null && typeof input === 'object' && input.type)
    return resolveCellType(input, doc.value, cellTypes.value)
  return listTypeAt(row, col)
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
const rows = useAxis(() => [rowCount.value, props.rowHeight, sizesOf('row', shownRowSizes.value)])
const cols = useAxis(() => [colCount.value, props.colWidth, sizesOf('col', shownColSizes.value)])

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
  if (el.scrollTop === scroll.value.top && el.scrollLeft === scroll.value.left) return
  scroll.value = { top: el.scrollTop, left: el.scrollLeft }
  // a note read in passing goes with the cell; one being written follows it
  if (noteShown.value) hideNote()
}

/** Wide enough for the longest row number. */
const headerWidth = computed(() =>
  props.headers ? Math.max(40, String(rowCount.value).length * 8 + 16) : 0,
)
const headerHeight = computed(() => (props.headers ? props.rowHeight : 0))
/** The outlines of the groups: a lane per depth, and one for the level buttons by the headers. */
const outlineSize = (depth: number) =>
  depth && props.outline ? (depth + (props.headers ? 1 : 0)) * OUTLINE_LANE : 0
const rowOutline = computed(() => outlineSize(groups.value.rows.depth))
const colOutline = computed(() => outlineSize(groups.value.cols.depth))

/**
 * Whether the line before is hidden, marked between the headers; lines a
 * folded group hides have its button instead.
 */
function afterHidden(axis: SheetAxisName, line: number) {
  const lines = axis === 'row' ? rows.value : cols.value
  return line > 0 && lines.hidden(line - 1) && !groups.value.axis(axis).hidden.has(line - 1)
}

/** Wheeling over an outline scrolls the grid. */
function onOutlineWheel(event: WheelEvent) {
  const el = viewport.value
  if (!el) return
  event.preventDefault()
  el.scrollBy({ left: event.deltaX, top: event.deltaY })
}
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
  /** Why the value doesn't fit the cell's type; shown on hover and read out. */
  problem?: string
  /** Whether the value breaks its type or a rule, which a corner mark shows. */
  invalid?: boolean
  /** The cell's note, which the other corner's mark shows. */
  note?: string
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

/** Where the cells drawn are: a sheet's key, its looks, rules and merges, and whether the selection shows. */
interface CellsOn {
  key: string | number
  looks: SheetLooks
  checks: SheetChecks
  merges: SheetMerges
  marks: boolean
}
const shownCells = computed<CellsOn>(() => ({
  key: sheetKey(sheet.value),
  looks: looks.value,
  checks: checks.value,
  merges: merges.value,
  marks: true,
}))

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
  on: CellsOn = shownCells.value,
): CellView {
  if (!span && on.merges.size && on.merges.at(row, col))
    return { col, text: '', cls: 'dou-sheet__cell is-covered', css: '', hidden: true }
  const input = line?.[col]
  let cls = 'dou-sheet__cell'
  let css = ''
  let text = ''
  let render: CellView['render']
  let renderProps: CellView['props']
  let label: string | undefined
  let problem: string | undefined
  let invalid = false
  const look = on.looks.lookAt(row, col)
  if (look?.bar) {
    cls += ' has-bar'
    css += barCss(look.bar)
  }
  if (input != null && input !== '') {
    const cell = typeof input === 'object' ? input : null
    let value = cell ? (cell.value ?? null) : (input as SheetValue)
    let error = false
    if (typeof value === 'string' && value.startsWith('=')) {
      const result = engine.result(on.key, row, col)
      error = isSheetError(result)
      value = isSheetError(result) ? result.code : result
    }
    const typed = cell?.type
      ? resolveCellType(cell, doc.value, cellTypes.value)
      : listTypeAt(row, col, on.checks)
    text = error
      ? (value as string)
      : (typed?.definition.format?.(value, typed.setup) ??
        formatValue(value, cell?.format, lang.value))
    // a number without a format fits the cell, as far as its digits allow
    if (typeof value === 'number' && !cell?.format && !typed?.definition.format && digitWidth.value)
      text = fitNumber(value, Math.max(1, Math.floor((width - 16) / digitWidth.value)))
    const style = look
      ? lookStyle(cell?.style, look)
      : cell?.style
        ? styleCache.value.get(cell.style)
        : undefined
    if (style) {
      if (style.cls) cls += ` ${style.cls}`
      css += style.css
    }
    // an error shows in the middle, as `TRUE` and `FALSE` do
    const align = style?.align
      ? 'left'
      : error
        ? 'center'
        : (typed?.definition.align ?? alignOf(value))
    if (error) {
      cls += ' is-error'
      problem = messages.value.errors[value as SheetErrorCode]
    }
    if (align !== 'left') cls += ` is-align-${align}`
    if (typed) {
      const { definition, setup } = typed
      cls += ` is-type-${definition.name}`
      const fits =
        !definition.valid || value == null || value === ''
          ? true
          : definition.valid(value, setup, messages.value)
      if (fits !== true) {
        cls += ' is-invalid'
        invalid = true
        problem = typeof fits === 'string' && fits ? fits : messages.value.invalid
      }
      if (definition.render) {
        render = definition.render
        renderProps = { value, text, setup, readonly: props.readonly }
        label = cellText(input, { sheet: on.key, row, col })
      }
    }
    if (!problem) {
      const c = on.checks
      const rule = c.empty ? undefined : c.ruleAt(row, col)
      if (rule && !c.fits(row, col, value, text)) {
        cls += ' is-invalid'
        invalid = true
        problem = ruleMessage(rule, messages.value)
      }
    }
  } else if (look?.style) {
    // an empty cell takes on a look too, such as a fill for blanks
    const style = lookStyle(undefined, look)
    if (style.cls) cls += ` ${style.cls}`
    css += style.css
  }
  const bottom = span ? span.bottom : row
  const right = span ? span.right : col
  // the selection, on the grid only
  if (on.marks) {
    for (const b of selectedBounds.value) {
      if (!inBounds(b, row, col)) continue
      if (!cls.includes(' is-selected')) cls += ' is-selected'
      if (row === b.top) cls += ' is-edge-top'
      if (bottom === b.bottom) cls += ' is-edge-bottom'
      if (col === b.left) cls += ' is-edge-left'
      if (right === b.right) cls += ' is-edge-right'
    }
    if (row === active.value.row && col === active.value.col) cls += ' is-active'
  }
  const view: CellView = { col, text, cls, css }
  if (render) {
    view.render = render
    view.props = renderProps
    view.label = label
  }
  if (problem) view.problem = problem
  if (invalid) view.invalid = true
  if (input && typeof input === 'object' && input.note) view.note = input.note
  return view
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
    // the note's mark is in the top right corner of the whole merge
    if (right !== m.right || paneTop !== m.top) view.note = undefined
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
    key += `${m.top},${m.left}:${rowId(sheet.value.cells[m.top])}:${resultsOf(m.top)}:${rowMarks(m.top)}|${rowMarks(m.bottom)};`
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
  engineId.value,
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
  // a result can change with any cell of the workbook
  void doc.value
  void engineId.value
  const text = cellText(sheet.value.cells[row]?.[col], { row, col })
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

const view = (): SheetHistoryView => ({ sheet: sheetKey(sheet.value), selection: selection.value })

/** An extension's history, used instead of the grid's own. */
let customFor: unknown
let custom: SheetHistoryHandler | null = null
function customHistory() {
  const make = resolved.value.history
  if (make !== customFor) {
    customFor = make
    custom = make ? make(context) : null
  }
  return custom
}

function syncHistory() {
  const handler = customHistory()
  canUndo.value = handler ? handler.canUndo() : history.canUndo
  canRedo.value = handler ? handler.canRedo() : history.canRedo
}

/**
 * Keeps the cell being edited on its cell when a change, such as another
 * person's, inserts, deletes or moves lines around it; stops the edit
 * when its cell is gone.
 */
function followEdit(tr: SheetTransaction) {
  const e = editing.value
  const was = e && tr.before.sheets[e.sheet]
  if (!e || !was) return
  const key = sheetKey(was)
  let { row, col } = e
  for (const step of tr.steps) {
    if (step.type === 'removeSheet' && step.sheet === key) return cancelEdit()
    if (
      (step.type !== 'insertLines' && step.type !== 'removeLines' && step.type !== 'moveLines') ||
      step.sheet !== key
    )
      continue
    const n = step.axis === 'row' ? row : col
    let next = n
    if (step.type === 'insertLines') next = n >= step.index ? n + step.count : n
    else if (step.type === 'removeLines') {
      if (n >= step.index && n < step.index + step.count) return cancelEdit()
      next = n >= step.index + step.count ? n - step.count : n
    } else next = movedIndex(step.from, step.count, step.to)(n)
    if (step.axis === 'row') row = next
    else col = next
  }
  // a sheet without an id is known by its name, which a rename changes
  const at = tr.doc.sheets.findIndex((s) => sheetKey(s) === key)
  const index = at === -1 ? e.sheet : at
  if (row !== e.row || col !== e.col || index !== e.sheet)
    editing.value = { ...e, sheet: index, row, col }
}

function apply(tr: SheetTransaction) {
  followEdit(tr)
  const was = tr.before.sheets[sheetIndex.value]
  engine.update(tr)
  doc.value = tr.doc
  sent = tr.doc
  emit('update:modelValue', tr.doc)
  emit('transaction', tr)
  if (was && tr.doc.sheets[sheetIndex.value] !== was) followSheet(tr, sheetKey(was))
}

/**
 * Keeps the sheet shown after sheets were added, removed or moved: the same
 * sheet where it went, or the one now in its place when it was removed.
 */
function followSheet(tr: SheetTransaction, key: string) {
  const sheets = tr.doc.sheets
  const at = sheets.findIndex((s) => sheetKey(s) === key)
  if (at !== -1) return setSheet(at)
  const removed = tr.steps.some((step) => step.type === 'removeSheet' && step.sheet === key)
  if (removed) setSheet(Math.min(sheetIndex.value, sheets.length - 1))
  // renamed: still the sheet shown, under another key
  else renamed = true
}
let renamed = false

function transact(
  run: (tr: SheetTransaction) => void,
  meta?: SheetTransactionMeta,
  before: SheetHistoryView = view(),
  /** Leave the copied range marked, as pasting a copy does. */
  keepMark = false,
) {
  // a change kept out of the history, such as another person's, still reaches a read-only grid
  if (props.readonly && meta?.history !== false) return null
  const tr = new SheetTransaction(doc.value, sheetIndex.value)
  tr.setMeta({ action: 'api', ...meta })
  run(tr)
  if (!tr.changed) return null
  for (const hook of resolved.value.transactions) hook(tr, context)
  if (!keepMark) clipMark.value = null
  apply(tr)
  if (!customHistory()) history.record(tr, before, view())
  syncHistory()
  return tr
}

function travel(direction: 'undo' | 'redo') {
  if (props.readonly) return false
  const handler = customHistory()
  if (handler) {
    const travelled = handler[direction]()
    syncHistory()
    if (travelled) announce(messages.value[direction === 'undo' ? 'undone' : 'redone'])
    return travelled
  }
  const result = direction === 'undo' ? history.undo(doc.value) : history.redo(doc.value)
  syncHistory()
  if (!result) return false
  result.tr.setMeta({ action: direction })
  apply(result.tr)
  const at = doc.value.sheets.findIndex((s) => sheetKey(s) === result.view.sheet)
  if (at !== -1) setSheet(at)
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

/** The index of a sheet, by index, `id` or name; `-1` when there is none. */
function indexOfSheet(target: SheetRef) {
  const sheets = doc.value.sheets
  if (typeof target === 'number') return target >= 0 && target < sheets.length ? target : -1
  return sheets.findIndex((s) => s.id === target || (s.id == null && s.name === target))
}

/** Shows a sheet, by index, `id` or name. */
function showSheet(target: SheetRef) {
  const at = indexOfSheet(target)
  if (at === -1) return false
  if (editing.value) commitEdit(undefined, true)
  setSheet(at)
  return true
}

/*
 * Each sheet keeps where it was left, its selection and scroll, and gets
 * them back when it shows again; a sheet not seen yet starts at A1.
 */
const sheetViews = new Map<string, { selection: SheetSelection; top: number; left: number }>()
watch(
  () => sheetKey(sheet.value),
  (key, old) => {
    if (renamed) {
      renamed = false
      return
    }
    sheetViews.set(old, { selection: selection.value, ...scroll.value })
    if (editing.value) cancelEdit()
    const back = sheetViews.get(key)
    setSelection(back?.selection ?? selectCell({ row: 0, col: 0 }))
    const top = back?.top ?? 0
    const leftBy = back?.left ?? 0
    scroll.value = { top, left: leftBy }
    void nextTick(() => {
      const el = viewport.value
      if (!el) return
      el.scrollTop = top
      el.scrollLeft = leftBy
    })
  },
)

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
/** Where the caret is in the text being edited. */
const editCaret = ref(0)
/** Other inputs that edit the cell too, such as the formula bar's. */
const editInputs = new Map<HTMLTextAreaElement | HTMLInputElement, SheetEditInputOptions>()
/** Whether an input shows the text and caret itself, from `editor.text` and `editor.caret`. */
const managed = (el: HTMLTextAreaElement | HTMLInputElement | undefined) =>
  !!el && !!editInputs.get(el)?.managed
/** The input the edit is typed in: one of `editInputs` while it has focus, else the cell's editor. */
function editInput(): HTMLTextAreaElement | HTMLInputElement | undefined {
  const el = document.activeElement
  if (el && editInputs.has(el as HTMLTextAreaElement)) return el as HTMLTextAreaElement
  return editor.value
}
/** Whether a formula is being edited, so references are marked and can be pointed at. */
const formulaEdit = computed(() => !!editing.value && editText.value.startsWith('='))
/** The references of the formula being edited, each with its color. */
const refMarks = computed(() => (formulaEdit.value ? formulaReferences(editText.value) : []))
/**
 * The reference the arrow keys or the pointer wrote last: moving on
 * replaces it, so pointing at another cell changes it instead of adding one.
 */
const pointing = shallowRef<{
  start: number
  end: number
  anchor: SheetPoint
  point: SheetPoint
} | null>(null)
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
  // typing in the formula bar keeps the focus there
  const owner = editInput()
  if (owner === el && document.activeElement !== el) el.focus({ preventScroll: true })
  if (text != null) el.setSelectionRange(el.value.length, el.value.length)
  editCaret.value = managed(owner)
    ? editText.value.length
    : (owner?.selectionStart ?? el.selectionStart)
  pointing.value = null
  fitEditor()
  return true
}

/** Changes the text being edited and puts the caret at `caret`, in every input that edits. */
function setEditText(text: string, caret = text.length) {
  const el = editor.value
  if (el && el.value !== text) el.value = text
  editText.value = text
  editTyped.value = true
  editCaret.value = caret
  const input = editInput()
  if (input && !managed(input)) {
    if (input.value !== text) input.value = text
    if (input.selectionStart !== caret || input.selectionEnd !== caret)
      input.setSelectionRange(caret, caret)
  }
  fitEditor()
  void nextTick(syncMirror)
}

/** Keeps the caret's position, after keys or a click moved it. */
function syncCaret() {
  const input = editInput()
  if (editing.value && input && !managed(input))
    editCaret.value = input.selectionStart ?? editText.value.length
  syncMirror()
}

/**
 * Writes a reference to the cells from `anchor` to `point` at the caret, or
 * in place of the one pointed at before. Only where a reference can go.
 */
function pointTo(anchor: SheetPoint, point: SheetPoint) {
  const text = editText.value
  const p = pointing.value
  if (!p && !canPointAt(text, editCaret.value)) return false
  const name = formatRange({ start: anchor, end: point })
  const start = p ? p.start : editCaret.value
  const end = p ? p.end : editCaret.value
  pointing.value = { start, end: start + name.length, anchor, point }
  setEditText(text.slice(0, start) + name + text.slice(end), start + name.length)
  scrollToPoint(point)
  return true
}

/** Whether a press on a cell would point at it, instead of finishing the edit. */
const pointable = () =>
  formulaEdit.value && (!!pointing.value || canPointAt(editText.value, editCaret.value))

function cancelEdit() {
  editing.value = null
  editText.value = ''
  editTyped.value = false
  editCaret.value = 0
  pointing.value = null
  assistShut.value = null
  if (editor.value) editor.value.value = ''
}

/**
 * Writes what was typed into the cell, then moves on when told which way.
 * A value a strict rule refuses isn't written: the edit stays open, or,
 * when `leaving` it (a press elsewhere, the focus going), is dropped.
 */
function commitEdit(move?: SheetDirection, leaving = false) {
  const e = editing.value
  if (!e) return
  const text = editor.value?.value ?? ''
  const typed = e.sheet === sheetIndex.value ? typeAt(e.row, e.col) : undefined
  const parsed = typed?.definition.parse?.(text, typed.setup) ?? parseInput(text)
  const refused = e.sheet === sheetIndex.value && refusal(e.row, e.col, parsed)
  if (refused) {
    showNotice(format(messages.value.validation.refused, { message: refused }))
    if (leaving) cancelEdit()
    return
  }
  cancelEdit()
  const before = { sheet: sheetKey(doc.value.sheets[e.sheet]!), selection: selection.value }
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

/** Why a strict rule refuses a typed value for a cell, or `''` when it doesn't. */
function refusal(row: number, col: number, parsed: { value?: SheetValue; format?: string }) {
  const c = checks.value
  const rule = c.empty ? undefined : c.ruleAt(row, col)
  const value = parsed.value ?? null
  // a formula's result is checked once it is worked out, and marked
  if (!rule || rule.strict === false || (typeof value === 'string' && value.startsWith('=')))
    return ''
  const old = cellOf(sheet.value.cells[row]?.[col])
  const text = formatValue(value, old?.format ?? parsed.format, lang.value)
  return c.fits(row, col, value, text) ? '' : ruleMessage(rule, messages.value)
}

/** Says what a cell now holds. */
function announceChange(at: { sheet: number; row: number; col: number }) {
  const cell = doc.value.sheets[at.sheet]?.cells[at.row]?.[at.col]
  const value = cellText(cell, at) || messages.value.empty
  announce(format(messages.value.changed, { cell: formatCell(at), value }))
}

/** A cell's value as it reads: its text, or whether it is checked. */
function cellText(
  input: SheetCellInput,
  at?: { sheet?: number | string; row: number; col: number },
) {
  const value = at
    ? shownValue(
        valueOf(input),
        (row, col) => engine.result(at.sheet ?? sheetKey(sheet.value), row, col),
        at.row,
        at.col,
      )
    : valueOf(input)
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

/**
 * Where the active cell's panel button goes: on its right edge, while it
 * isn't edited or dragged from. A finger that only touches down keeps it:
 * iPhones drop the tap's click when something shows up during the tap.
 */
const panelButton = computed(() => {
  if (props.readonly || editing.value || drag.value?.started) return null
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
  editCaret.value = editor.value?.selectionStart ?? editText.value.length
  // typing ends pointing: the next cell pointed at is a new reference
  pointing.value = null
  fitEditor()
  syncMirror()
}

/** What another input that edits typed, as `useSheet().editor.input`. */
function inputFrom(text: string, caret = text.length) {
  if (!editing.value && !beginEdit('edit')) return false
  pointing.value = null
  setEditText(text, caret)
  return true
}

function onCompositionStart() {
  if (!editing.value && !beginEdit('enter') && editor.value) editor.value.value = ''
}

function onInputBlur(event: FocusEvent) {
  focused.value = false
  // switching windows, or to the formula bar, keeps the edit open
  if (editInputs.has(event.relatedTarget as HTMLTextAreaElement)) return
  if (editing.value && document.hasFocus()) commitEdit(undefined, true)
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
  // and on a filter's heading, its filter panel
  if (key === 'ArrowDown' && event.altKey && !mod && openFilterAtActive())
    return event.preventDefault()
  // with nothing to open it does nothing, rather than scroll the page
  if ((key === 'ArrowDown' || key === 'ArrowUp') && event.altKey) return event.preventDefault()
  // Alt + Shift + → groups the selected rows (or whole columns), ← takes them out
  if ((key === 'ArrowRight' || key === 'ArrowLeft') && event.altKey && event.shiftKey && !mod) {
    event.preventDefault()
    if (props.readonly) return announce(messages.value.readonly)
    return groupSelected(groupAxis(), key === 'ArrowRight')
  }
  if (arrow && !event.altKey) {
    event.preventDefault()
    if (event.shiftKey) return extend(arrow, mod)
    return moveActive(arrow, mod)
  }
  // Ctrl + PageUp / PageDown: the sheet before or after
  if (event.ctrlKey && !event.shiftKey && (key === 'PageUp' || key === 'PageDown')) {
    event.preventDefault()
    const at = sheetIndex.value + (key === 'PageUp' ? -1 : 1)
    if (at < 0 || at >= doc.value.sheets.length) return
    showSheet(at)
    return announce(format(messages.value.sheetShown, { name: doc.value.sheets[at]!.name }))
  }
  if (matchesHotkey(event, 'mod+z')) return done(event, travel('undo'))
  if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y'))
    return done(event, travel('redo'))
  if (matchesHotkey(event, 'mod+a')) return done(event, selectAll())
  if (matchesHotkey(event, 'mod+shift+l')) {
    event.preventDefault()
    if (props.readonly) return announce(messages.value.readonly)
    return toggleFilter()
  }
  for (const [hotkey, name] of STYLE_KEYS)
    if (matchesHotkey(event, hotkey)) {
      event.preventDefault()
      return toggleStyle(name)
    }
  if (matchesHotkey(event, 'mod+\\')) {
    event.preventDefault()
    if (clearFormatting()) announce(messages.value.formattingCleared)
    return
  }
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
      // Shift + F2 writes the cell's note
      if (event.shiftKey) return editNote()
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
  const list = assist.value?.kind === 'list' ? assist.value : null
  if (list && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      const step = key === 'ArrowDown' ? 1 : -1
      assistIndex.value = (assistIndex.value + step + list.items.length) % list.items.length
      return
    }
    if (key === 'Tab' || key === 'Enter') {
      event.preventDefault()
      return completeName(list.items[assistIndex.value]!)
    }
    if (key === 'Escape') {
      event.preventDefault()
      assistShut.value = editText.value
      return
    }
  }
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
  const plain = !event.ctrlKey && !event.metaKey && !event.altKey
  if (arrow && mode === 'enter' && plain && pointable()) {
    // in a formula, where a reference can go, the arrows point at cells
    event.preventDefault()
    const e = editing.value!
    const p = pointing.value
    const from = p ? p.point : { row: e.row, col: e.col }
    const next = movePoint(from, arrow, axes(), filled, false)
    pointTo(event.shiftKey ? (p?.anchor ?? from) : next, next)
    return
  }
  if (arrow && mode === 'enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    return commitEdit(arrow)
  }
}

// Formula help: the functions to pick from while typing a name, and what a call takes --------

/** The functions formulas can call, by name. */
const functionList = computed(() => {
  void engineId.value
  return engine.functionList()
})
/** What a function takes and does: its own words, or the built-in help in the grid's language. */
/** The functions used most, in the order the list shows them before the rest. */
const COMMON = [
  'SUM',
  'AVERAGE',
  'IF',
  'COUNT',
  'MAX',
  'MIN',
  'ROUND',
  'SUMIF',
  'COUNTIF',
  'IFERROR',
  'VLOOKUP',
  'XLOOKUP',
  'AND',
  'OR',
  'CONCAT',
  'TODAY',
]
const rankOf = (name: string) => {
  const at = COMMON.indexOf(name)
  return at === -1 ? COMMON.length : at
}
function helpOf(fn: SheetFunction) {
  const name = fn.name.toUpperCase()
  const own = messages.value.functions[name]
  return {
    name,
    args: fn.args ?? own?.args ?? [],
    description: fn.description ?? own?.description ?? '',
  }
}
/** The text the list was closed at with Escape; it stays closed until the text changes. */
const assistShut = ref<string | null>(null)
const assistIndex = ref(0)
const assistId = `${uid}-assist`

/**
 * What shows under the input while a formula is typed: the functions whose
 * names start with what is typed, or the arguments of the call the caret is in.
 */
const assist = computed(() => {
  if (!formulaEdit.value) return null
  const text = editText.value
  const caret = editCaret.value
  const name = assistShut.value === text ? null : nameAt(text, caret)
  if (name) {
    const prefix = name.text.toUpperCase()
    const items = functionList.value
      .filter((fn) => fn.name.toUpperCase().startsWith(prefix))
      .map(helpOf)
    // the functions used most come first, so Tab after `=SU` writes SUM
    items.sort((a, b) => rankOf(a.name) - rankOf(b.name))
    if (items.length) return { kind: 'list' as const, ...name, items }
  }
  const call = callAt(text, caret)
  const fn = call && functionList.value.find((f) => f.name.toUpperCase() === call.name)
  if (!call || !fn) return null
  const help = helpOf(fn)
  // past the last argument, a repeating one (`…`) goes on
  const repeat = help.args[help.args.length - 1] === '…'
  const arg =
    call.arg < help.args.length - (repeat ? 1 : 0) ? call.arg : repeat ? help.args.length - 2 : -1
  return { kind: 'hint' as const, ...help, arg }
})
watch(
  () => (assist.value?.kind === 'list' ? `${assist.value.start}:${assist.value.text}` : ''),
  () => (assistIndex.value = 0),
)
watch(assistIndex, (index) => {
  void nextTick(() =>
    document.getElementById(`${assistId}-${index}`)?.scrollIntoView({ block: 'nearest' }),
  )
})

/** Writes a function's name and its `(` over the name being typed. */
function completeName(item: { name: string }) {
  const list = assist.value
  if (list?.kind !== 'list') return
  const text = editText.value
  const insert = `${item.name}(`
  setEditText(text.slice(0, list.start) + insert + text.slice(list.end), list.start + insert.length)
}

/**
 * Where the formula help shows: under the input being typed in, or above it
 * near the bottom of the window. Fixed, so a formula bar outside the grid has it too.
 */
const assistStyle = computed(() => {
  const e = editing.value
  if (!assist.value || !e) return ''
  void editText.value
  void scroll.value
  const input = editInput()
  let box: { left: number; top: number; bottom: number } | undefined
  if (input && input !== editor.value)
    box = (editInputs.get(input)?.anchor ?? input).getBoundingClientRect()
  else {
    const base = (editor.value?.offsetParent ?? root.value)?.getBoundingClientRect()
    if (!base) return ''
    const rect = cellRect(e)
    const top = base.top + rect.y - 1
    box = {
      left: base.left + rect.x - 1,
      top,
      bottom: top + Math.max(editorSize.value.height, rect.height) + 1,
    }
  }
  const room = window.innerHeight - box.bottom
  const left = Math.max(8, Math.min(box.left, window.innerWidth - 328))
  return room < 200 && box.top > room
    ? `left:${left}px;bottom:${window.innerHeight - box.top + 4}px`
    : `left:${left}px;top:${box.bottom + 4}px`
})

// The formula as it is typed, with its references in their colors, drawn under the editor's text

const mirror = ref<HTMLElement>()
const mirrorParts = computed(() =>
  formulaEdit.value ? formulaParts(editText.value, refMarks.value) : [],
)
function syncMirror() {
  const el = editor.value
  const m = mirror.value
  if (!el || !m) return
  m.scrollLeft = el.scrollLeft
  m.scrollTop = el.scrollTop
}

/** The references of the formula being edited that are on the sheet shown, as boxes over the grid. */
const refRects = computed(() => {
  const name = sheet.value.name.toLowerCase()
  const seen = new Set<string>()
  const out: { rect: ViewRect; color: number; key: string }[] = []
  const lastRow = rowCount.value - 1
  const lastCol = colCount.value - 1
  for (const mark of refMarks.value) {
    if (mark.sheet != null && mark.sheet.toLowerCase() !== name) continue
    const b = mark.bounds
    const key = `${b.top}:${b.left}:${b.bottom}:${b.right}`
    if (seen.has(key) || b.top > lastRow || b.left > lastCol) continue
    seen.add(key)
    const rect = rangeRect({
      top: b.top,
      left: b.left,
      bottom: Math.min(b.bottom, lastRow),
      right: Math.min(b.right, lastCol),
    })
    if (rect) out.push({ rect, color: mark.color, key })
  }
  return out
})

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
const clipMark = shallowRef<{ sheet: string; bounds: SheetBounds; cut: string | null } | null>(null)
const clipRect = computed(() => {
  const mark = clipMark.value
  return mark && mark.sheet === sheetKey(sheet.value) ? rangeRect(mark.bounds) : null
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
  const bounds = {
    top: b.top,
    left: b.left,
    bottom: b.top + height - 1,
    right: b.left + width - 1,
  }
  clipMark.value = { sheet: sheetKey(sheet.value), bounds, cut: id }
  announce(format(messages.value[cut ? 'cutDone' : 'copied'], { range: rangeName(bounds) }))
  const key = sheetKey(sheet.value)
  return formatClip(clip, {
    locale: lang.value,
    text: typedText,
    result: (row, col) => engine.result(key, b.top + row, b.left + col),
  })
}

/** A cell's text as its type shows it, such as 80% for 0.8; `undefined` for a plain cell. */
function typedText(input: SheetCellInput, value: SheetValue) {
  const cell = cellOf(input)
  const typed = cell?.type ? resolveCellType(cell, doc.value, cellTypes.value) : undefined
  return typed?.definition.format?.(value, typed.setup)
}

/** A sheet as CSV, with what its cells show. */
function toCSV(options: SheetCSVWriteOptions & { sheet?: SheetRef } = {}) {
  const { sheet: target, ...rest } = options
  const data = doc.value.sheets[target == null ? sheetIndex.value : indexOfSheet(target)]
  if (!data) throw new RangeError(`There is no sheet "${target}"`)
  const key = sheetKey(data)
  return sheetToCSV(data, {
    locale: lang.value,
    text: typedText,
    result: (row, col) => engine.result(key, row, col),
    ...rest,
  })
}

// Images and printing --------------------------------------------------------------------

/** What export draws: the sheet shown, or another one laid out as it would be shown. */
function exportTarget(which?: SheetRef): SheetExportTarget {
  if (which == null) {
    const on: CellsOn = { ...shownCells.value, marks: false }
    return {
      data: sheet.value,
      rows: rows.value,
      cols: cols.value,
      frozen: frozen.value,
      merges: merges.value,
      cellView: (row, col, line, width, span) => cellView(row, col, line, width, span, on),
    }
  }
  const data = doc.value.sheets[indexOfSheet(which)]
  if (!data) throw new RangeError(`There is no sheet "${which}"`)
  if (data === sheet.value) return exportTarget()
  // another sheet, laid out as it would be shown
  const folded = shownGroupsOf(data)
  const rowSizes = hideIn(
    data.rowSizes ?? NO_SIZES,
    rowsFilteredOut(undefined, data),
    folded.rows.hidden,
  )
  const colSizes = hideIn(data.colSizes ?? NO_SIZES, folded.cols.hidden)
  const rowAxis = new SheetAxis(rowCountOf(data), props.rowHeight, rowSizes)
  const colAxis = new SheetAxis(colCountOf(data), props.colWidth, colSizes)
  const merged = mergesOf(data)
  const on: CellsOn = {
    key: sheetKey(data),
    looks: looksOf(data),
    checks: checksOf(data),
    merges: merged,
    marks: false,
  }
  return {
    data,
    rows: rowAxis,
    cols: colAxis,
    frozen: {
      rows: Math.max(0, Math.min(rowAxis.count, data.freeze?.rows ?? 0)),
      cols: Math.max(0, Math.min(colAxis.count, data.freeze?.cols ?? 0)),
    },
    merges: merged,
    cellView: (row, col, line, width, span) => cellView(row, col, line, width, span, on),
  }
}

const { exportSVG, exportPNG, print } = createSheetExport({
  root: () => root.value,
  target: exportTarget,
  rowHeight: () => props.rowHeight,
  gridlines: () => props.gridlines,
})

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
  const sizes = (axis === 'row' ? sheet.value.rowSizes : sheet.value.colSizes) ?? NO_SIZES
  transact(
    (tr) => {
      for (let i = from; i < from + count; i++)
        if (hide) tr.setSize(axis, i, 0)
        else if (sizes[i] === 0) tr.setSize(axis, i, undefined)
    },
    { action: 'hide' },
  )
}

/** Whether any of the selected rows (or columns) is hidden, or right beside them. */
function hasHidden(axis: SheetAxisName) {
  const { from, count } = linesOf(axis)
  // rows a filter hides don't count: they show again with the filter
  const sizes = (axis === 'row' ? sheet.value.rowSizes : sheet.value.colSizes) ?? NO_SIZES
  const last = (axis === 'row' ? rowCount.value : colCount.value) - 1
  for (let i = Math.max(0, from - 1); i <= Math.min(last, from + count); i++)
    if (sizes[i] === 0) return true
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
    for (const [row, line] of cells.entries()) {
      const input = line?.[index]
      if (isBlank(input)) continue
      const cell = cellOf(input)
      const style = cell?.style ? doc.value.styles?.[cell.style] : undefined
      fitCanvas.font = style?.bold ? bold : plain
      const value = shownValue(valueOf(input), resultAt, row, index)
      const text = formatValue(value, cell?.format, lang.value)
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
    const value = shownValue(cell.value ?? null, resultAt, index, col)
    probe.textContent = formatValue(value, cell.format, lang.value)
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

// Groups ---------------------------------------------------------------------------------

const lineName = (axis: SheetAxisName, line: number) =>
  axis === 'row' ? line + 1 : columnName(line)

/** The text of a group's button, or with `after`, what is read out after pressing it. */
function groupText(axis: SheetAxisName, g: SheetGroupLines, collapsed: boolean, after = false) {
  const m = messages.value.group
  const key = after
    ? axis === 'row'
      ? collapsed
        ? 'collapsedRows'
        : 'expandedRows'
      : collapsed
        ? 'collapsedCols'
        : 'expandedCols'
    : axis === 'row'
      ? collapsed
        ? 'collapseRows'
        : 'expandRows'
      : collapsed
        ? 'collapseCols'
        : 'expandCols'
  return format(m[key], { lines: linesText(axis, g) })
}

/** A group's lines, as `第 4–6 行`, `第 4 行` or `C 列`. */
function linesText(axis: SheetAxisName, g: { start: number; end: number }) {
  const m = messages.value.group
  const one = g.start === g.end
  const text = axis === 'row' ? (one ? m.rowLine : m.rowLines) : one ? m.colLine : m.colLines
  return format(text, { from: lineName(axis, g.start), to: lineName(axis, g.end) })
}

/** Where the shown sheet's groups keep their headings or subtotals. */
const groupSummary = computed(() => sheet.value.groupSummary ?? 'before')

/** Folds groups for this view alone, as a read-only grid does. */
function foldInView(list: { g: SheetGroupLines; collapsed: boolean }[]) {
  const folds = new Map(viewFolds.value)
  for (const { g, collapsed } of list)
    folds.set(foldKey(sheet.value, sheet.value.groups![g.index]!.range), collapsed)
  viewFolds.value = folds
}

/** Folds a group away or shows it again. */
function toggleGroup(axis: SheetAxisName, g: SheetGroupLines) {
  const collapsed = !g.collapsed
  if (props.readonly) foldInView([{ g, collapsed }])
  else if (
    !transact(
      (tr) => {
        const range = groupRange(axis, g.start, g.end)
        if (collapsed) tr.collapseGroup(range)
        else tr.expandGroup(range)
      },
      { action: 'group' },
    )
  )
    return
  keepActiveShown()
  announce(groupText(axis, g, collapsed, true))
}

/** Shows the groups of an axis down to a level, as the level buttons do. */
function showGroupLevel(axis: SheetAxisName, level: number) {
  if (props.readonly)
    foldInView(groups.value.axis(axis).list.map((g) => ({ g, collapsed: g.depth >= level })))
  else transact((tr) => tr.showGroupLevel(axis, level), { action: 'group' })
  keepActiveShown()
  announce(format(messages.value.group.levelShown, { level }))
}

/** After lines fold away under the active cell, moves it to the nearest line still shown. */
function keepActiveShown() {
  const { row, col } = active.value
  const r = rows.value.hidden(row) ? rows.value.visibleFrom(row, -1) : row
  const c = cols.value.hidden(col) ? cols.value.visibleFrom(col, -1) : col
  if (r !== row || c !== col) setSelection(selectCell({ row: r, col: c }))
}

/** Groups the selected rows (or columns), or takes them out of their groups. */
function groupSelected(axis: SheetAxisName, group: boolean) {
  const { from, count } = linesOf(axis)
  const m = messages.value.group
  const end = from + count - 1
  // say why lines can't be grouped, before trying
  const problem = group ? groups.value.axis(axis).problem(from, end) : null
  if (problem && !groups.value.axis(axis).find(from, end)) {
    const text =
      problem === 'deep' ? m.tooDeep : format(m.crossing, { group: linesText(axis, problem.cross) })
    announce(text)
    showNotice(text)
    return
  }
  const changed = transact(
    (tr) => {
      const lines = { from, count }
      if (group) {
        if (axis === 'row') tr.groupRows(lines)
        else tr.groupCols(lines)
      } else if (axis === 'row') tr.ungroupRows(lines)
      else tr.ungroupCols(lines)
    },
    { action: 'group' },
  )
  if (!changed) return
  announce(
    group ? format(m[axis === 'row' ? 'groupedRows' : 'groupedCols'], { count }) : m.ungrouped,
  )
}

/** Rows (or columns) for the keys: columns when whole columns are selected. */
const groupAxis = (): SheetAxisName => (whole(lastBounds(), 'col') ? 'col' : 'row')

/** The innermost group around the active cell's line, or whose button is on it. */
function groupAtActive(axis: SheetAxisName) {
  const line = axis === 'row' ? active.value.row : active.value.col
  const laid = groups.value.axis(axis)
  const count = axis === 'row' ? rowCount.value : colCount.value
  return (
    laid.list.find((g) => laid.buttonLine(g, count, groupSummary.value) === line) ??
    laid.around(line).at(-1)
  )
}

/** Menu items for grouping rows (or columns), and folding the group at the active cell. */
function groupItems(axis: SheetAxisName): SheetMenuItem[] {
  const m = messages.value.group
  const { from, count } = linesOf(axis)
  const laid = groups.value.axis(axis)
  const end = from + count - 1
  // the keys group rows, or columns when whole columns are selected
  const keys = groupAxis() === axis
  const out: SheetMenuItem[] = [
    {
      key: `${axis}-group`,
      label: format(m[axis === 'row' ? 'groupRows' : 'groupCols'], { count }),
      icon: axis === 'row' ? RowGroupIcon : ColumnGroupIcon,
      shortcut: keys ? 'alt+shift+ArrowRight' : undefined,
      run: () => groupSelected(axis, true),
    },
  ]
  if (laid.list.some((g) => g.start <= end && g.end >= from))
    out.push({
      key: `${axis}-ungroup`,
      label: m[axis === 'row' ? 'ungroupRows' : 'ungroupCols'],
      icon: axis === 'row' ? RowUngroupIcon : ColumnUngroupIcon,
      shortcut: keys ? 'alt+shift+ArrowLeft' : undefined,
      run: () => groupSelected(axis, false),
    })
  const at = groupAtActive(axis)
  if (at)
    out.push({
      key: `${axis}-fold`,
      label: groupText(axis, at, !at.collapsed),
      icon: at.collapsed ? UnfoldVerticalIcon : FoldVerticalIcon,
      run: () => toggleGroup(axis, at),
    })
  return out
}

// Notes ----------------------------------------------------------------------------------

/** The note showing: read on hover or after a tap, or being written. */
interface NoteShown extends SheetPoint {
  /** What showed it: the mouse, a finger, the active cell, or writing it. */
  by: 'hover' | 'tap' | 'active' | 'edit'
}
const noteShown = shallowRef<NoteShown | null>(null)
let noteTimer: ReturnType<typeof setTimeout> | undefined

/** A cell's note; a merged cell's is on its top left cell. */
function noteAt(point: SheetPoint) {
  const cell = sheet.value.cells[point.row]?.[point.col]
  return cell && typeof cell === 'object' ? cell.note : undefined
}

/** The cell a note belongs to: the top left of a merge. */
function noteHome(point: SheetPoint): SheetPoint {
  const span = merges.value.cell(point)
  return { row: span.top, col: span.left }
}

const sameCell = (a: SheetPoint | null | undefined, b: SheetPoint) =>
  !!a && a.row === b.row && a.col === b.col

/** Where the note's cell is on the page, for the note to sit beside. */
const noteAnchor: VirtualElement = {
  getBoundingClientRect() {
    const at = noteShown.value
    const el = viewport.value
    if (!at || !el) return new DOMRect()
    const box = el.getBoundingClientRect()
    const r = cellRect(at)
    return new DOMRect(
      box.left + el.clientLeft + r.x,
      box.top + el.clientTop + r.y,
      r.width,
      r.height,
    )
  },
}

/** Hides a note being read, not one being written; `after` some ms. */
function hideNote(after = 0) {
  clearTimeout(noteTimer)
  if (after) noteTimer = setTimeout(hideNote, after)
  else if (noteShown.value?.by !== 'edit') noteShown.value = null
}

/** How long the pointer rests on a cell before its note shows, and leaves before it goes. */
const NOTE_SHOW = 300
const NOTE_HIDE = 200

/** A mouse resting on a cell with a note shows it; moving on to another one switches at once. */
function hoverNote(event: PointerEvent) {
  if (noteShown.value?.by === 'edit' || drag.value) return
  const hit = hitAt(event.clientX, event.clientY)
  const point = hit.area === 'cell' ? noteHome(hit) : null
  if (point && sameCell(noteShown.value, point)) return clearTimeout(noteTimer)
  if (!point || !noteAt(point)) {
    if (noteShown.value) hideNote(NOTE_HIDE)
    else clearTimeout(noteTimer)
    return
  }
  clearTimeout(noteTimer)
  const show = () => (noteShown.value = { ...point, by: 'hover' })
  if (noteShown.value) show()
  else noteTimer = setTimeout(show, NOTE_SHOW)
}

/** The pointer moving onto the note keeps it; leaving it lets it go. */
function onNoteHover(inside: boolean) {
  onNote = inside
  if (inside) clearTimeout(noteTimer)
  else if (noteShown.value?.by === 'hover') hideNote(NOTE_HIDE)
}

/** Opens the box to write the note of a cell, the active one by default. */
function editNote(at: SheetPoint = active.value) {
  if (props.readonly) return announce(messages.value.readonly)
  const point = noteHome(at)
  clearTimeout(noteTimer)
  scrollToPoint(point)
  noteShown.value = { ...point, by: 'edit' }
}

/** Keeps what was written; `leaving` when focus left the box for something else. */
function saveNote(text: string, leaving: boolean) {
  const at = noteShown.value
  noteShown.value = null
  if (!at) return
  const before = noteAt(at) ?? ''
  const after = text.trim() ? text : ''
  if (after !== before) {
    const m = messages.value.note
    if (transact((tr) => tr.setNote(at, after || undefined), { action: 'note' }))
      announce(after ? m.saved : m.removed)
  }
  if (!leaving) focusGrid()
}

function cancelNote(leaving: boolean) {
  noteShown.value = null
  if (!leaving) focusGrid()
}

/** How many notes the selection holds. */
function notesSelected() {
  let count = 0
  forEachSelected((point) => {
    if (noteAt(point)) count++
  })
  return count
}

function removeNotes() {
  if (props.readonly) return announce(messages.value.readonly)
  const count = notesSelected()
  if (!count) return
  const ranges = selection.value.ranges
  const m = messages.value.note
  if (
    transact(
      (tr) => {
        for (const range of ranges) tr.clearNotes(boundsOf(range))
      },
      { action: 'note' },
    )
  )
    announce(count === 1 ? m.removed : format(m.removedMany, { count }))
}

/** Menu items for the note of the active cell, and taking the selection's notes off. */
function noteItems(): SheetMenuItem[] {
  const m = messages.value.note
  const has = !!noteAt(noteHome(active.value))
  const items: SheetMenuItem[] = [
    {
      key: 'note',
      label: has ? m.edit : m.add,
      icon: has ? MessageTextIcon : MessagePlusIcon,
      shortcut: 'shift+F2',
      divided: true,
      run: () => editNote(),
    },
  ]
  const count = notesSelected()
  if (count)
    items.push({
      key: 'note-remove',
      label: count === 1 ? m.remove : format(m.removeMany, { count }),
      icon: MessageXIcon,
      run: removeNotes,
    })
  return items
}

/*
 * The active cell's note shows too, after the same pause as a mouse's, so
 * moving onto a cell with the keys shows its note; it goes once another
 * cell is chosen, or the cell is being edited.
 */
watch(active, (point) => {
  const home = noteHome(point)
  const now = noteShown.value
  if (now?.by === 'edit' || sameCell(now, home)) return
  if (now?.by === 'active' || now?.by === 'tap') hideNote()
  if (!noteAt(home) || now?.by === 'hover') return
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => {
    if (
      !noteShown.value &&
      !editing.value &&
      focusInside() &&
      sameCell(noteHome(active.value), home)
    )
      noteShown.value = { ...home, by: 'active' }
  }, NOTE_SHOW)
})
watch(editing, (on) => {
  if (on) hideNote()
})

/** Whether focus is in the grid, or in what it shows, such as a note. */
const focusInside = () => !!root.value?.contains(document.activeElement)

/** Whether the pointer is on the note being read. */
let onNote = false
watch(noteShown, (note) => {
  if (!note) onNote = false
})

/**
 * Escape closes a note being read, as it closes any overlay. It is the
 * grid's own Escape only when focus is in the grid or the pointer is on
 * the note; otherwise it still reaches what has focus, such as a dialog.
 */
function onNoteEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing || noteShown.value?.by === 'edit') return
  hideNote()
  if (!focusInside() && !onNote) return
  event.preventDefault()
  event.stopPropagation()
}

/** A note shown for the active cell goes when focus leaves the grid. */
function onFocusout(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && root.value?.contains(next)) return
  const by = noteShown.value?.by
  if (by === 'active' || by === 'tap') hideNote()
}
watch(
  () => !!noteShown.value && noteShown.value.by !== 'edit',
  (reading) => {
    if (typeof window === 'undefined') return
    if (reading) window.addEventListener('keydown', onNoteEscape, true)
    else window.removeEventListener('keydown', onNoteEscape, true)
  },
)
onBeforeUnmount(() => {
  clearTimeout(noteTimer)
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onNoteEscape, true)
})

/**
 * The note mark of the cell under the fill handle, drawn over the handle
 * so it isn't hidden; `null` when that cell has no note.
 */
const noteUnderFill = computed(() => {
  const at = fillRect.value
  if (!at) return null
  const b = lastBounds()
  const below = { row: b.bottom + 1, col: b.right }
  if (below.row >= rowCount.value || rows.value.size(below.row) <= 0) return null
  const span = merges.value.cell(below)
  if (span.top !== below.row || span.right !== b.right || !noteAt(noteHome(below))) return null
  return at
})

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
    return [
      ...items,
      ...dividedFirst(lines),
      ...visibility(area),
      ...dividedFirst(groupItems(area)),
      clear,
    ]
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
    {
      key: 'group',
      label: m.group.group,
      icon: RowGroupIcon,
      children: [...groupItems('row'), ...dividedFirst(groupItems('col'))],
    },
    ...noteItems(),
    ...dataItems(),
    clear,
  ]
}

/** Sorting and filtering. */
function dataItems(): SheetMenuItem[] {
  const m = messages.value.filter
  const items: SheetMenuItem[] = [
    {
      key: 'sort',
      label: m.sort,
      icon: SortIcon,
      divided: true,
      children: [
        {
          key: 'sort-asc',
          label: m.sortAsc,
          icon: SortAscendingIcon,
          run: () => sortSelection('asc'),
        },
        {
          key: 'sort-desc',
          label: m.sortDesc,
          icon: SortDescendingIcon,
          run: () => sortSelection('desc'),
        },
      ],
    },
    {
      key: 'filter',
      label: sheet.value.filter ? m.turnOff : m.turnOn,
      icon: sheet.value.filter ? FilterXIcon : FilterIcon,
      shortcut: 'mod+shift+l',
      run: toggleFilter,
    },
  ]
  if (sheet.value.filter?.columns)
    items.push({ key: 'filter-clear', label: m.clearAll, run: clearFilters })
  return items
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

// How the selection looks ------------------------------------------------------------------

const NO_STYLE: SheetStyle = Object.freeze({})

const STYLE_KEYS: [string, StyleToggle][] = [
  ['mod+b', 'bold'],
  ['mod+i', 'italic'],
  ['mod+u', 'underline'],
  ['mod+shift+x', 'strike'],
]

/** A cell's style, or `{}`; a merged cell has its top left cell's. */
function styleAt(point: SheetPoint): SheetStyle {
  const at = merges.value.size ? merges.value.anchor(point) : point
  const name = cellOf(sheet.value.cells[at.row]?.[at.col])?.style
  return (name && doc.value.styles?.[name]) || NO_STYLE
}

/** A cell's number or date format; a merged cell has its top left cell's. */
function formatAt(point: SheetPoint) {
  const at = merges.value.size ? merges.value.anchor(point) : point
  return cellOf(sheet.value.cells[at.row]?.[at.col])?.format
}

/** Runs `run` on each selected range, kept inside the sheet, as one change. */
function changeSelected(run: (tr: SheetTransaction, b: SheetBounds) => void) {
  if (props.readonly) {
    announce(messages.value.readonly)
    return false
  }
  return !!transact(
    (tr) => {
      for (const range of selection.value.ranges) {
        const b = boundsOf(range)
        run(tr, {
          top: Math.max(0, b.top),
          left: Math.max(0, b.left),
          bottom: Math.min(rowCount.value - 1, b.bottom),
          right: Math.min(colCount.value - 1, b.right),
        })
      }
    },
    { action: 'style' },
  )
}

const styleSelection = (patch: SheetStylePatch | null) =>
  changeSelected((tr, b) => tr.styleCells(b, patch))

const formatSelection: SheetContext['formatSelection'] = (to) =>
  changeSelected((tr, b) => tr.formatCells(b, to))

const clearFormatting = () =>
  changeSelected((tr, b) => {
    tr.styleCells(b, null)
    tr.formatCells(b, undefined)
  })

type StyleToggle = 'bold' | 'italic' | 'underline' | 'strike'

/** Turns bold (or another) on for the selection, or off when the active cell has it. */
function toggleStyle(name: StyleToggle) {
  const on = !styleAt(active.value)[name]
  if (!styleSelection({ [name]: on || undefined })) return
  announce(
    format(on ? messages.value.styleOn : messages.value.styleOff, { name: messages.value[name] }),
  )
}

/** Whether the selection touches merged cells, and whether it could be merged. */
const merged = computed(() => merges.value.touching(lastBounds()).length > 0)
const canMerge = computed(() => {
  const b = lastBounds()
  const touched = merges.value.touching(b)
  return (
    !(touched.length === 1 && sameBounds(touched[0]!, b)) &&
    (b.top !== b.bottom || b.left !== b.right) &&
    selection.value.ranges.length === 1
  )
})

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
  mode: Hit['area'] | 'fill' | 'resize' | 'move' | 'point'
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
  if (editing.value && hit.area === 'cell' && event.button === 0 && pointable()) {
    // writing a formula: the cell pressed goes into it, and the input keeps the focus
    event.preventDefault()
    lastPointer = event.pointerType
    const point = { row: hit.row, col: hit.col }
    if (event.pointerType === 'touch') {
      // a finger that moves scrolls; a tap points
      startDrag(event, { mode: 'point', started: false })
      return
    }
    pointTo(event.shiftKey && pointing.value ? pointing.value.anchor : point, point)
    startDrag(event, { mode: 'point', started: true })
    frame = requestAnimationFrame(autoScroll)
    return
  }
  if (editing.value) commitEdit(undefined, true)
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
  if (d.mode === 'point') {
    const p = pointing.value
    if (p && (p.point.row !== hit.row || p.point.col !== hit.col))
      pointTo(p.anchor, { row: hit.row, col: hit.col })
    d.moved = true
    return
  }
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
    case 'point':
      if (!d.started) {
        const hit = hitAt(d.x0, d.y0)
        if (hit.area === 'cell')
          pointTo({ row: hit.row, col: hit.col }, { row: hit.row, col: hit.col })
      }
      return
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
  if (event.pointerType !== 'mouse' || drag.value) return
  hoverNote(event)
  if (props.readonly) return
  const edge = edgeAt(hitAt(event.clientX, event.clientY), false)
  edgeHover.value = edge?.axis ?? null
}

function onLeave() {
  edgeHover.value = null
  if (noteShown.value?.by === 'hover') hideNote(NOTE_HIDE)
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
    hideNote()
    // inside the tap, so phones show their keyboard
    editActive()
    return
  }
  press(hit, { shiftKey: false, ctrlKey: false, metaKey: false })
  focusGrid()
  announce(activeLabel.value)
  // a finger can't rest on a cell: tapping one shows its note
  const home = hit.area === 'cell' ? noteHome(hit) : null
  if (home && noteAt(home)) {
    clearTimeout(noteTimer)
    noteShown.value = { ...home, by: 'tap' }
  }
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
const promptId = `${uid}-prompt`
/** The active cell's rule's hint, shown under it while nothing covers it. */
/** Width of the hint beside the active cell, at most. */
const HINT_WIDTH = 240
/** The narrowest the hint gets beside the cell before it moves under it. */
const HINT_MIN = 160
/** About how tall a two-line hint is, to tell whether it fits under the cell. */
const HINT_HEIGHT = 64
/**
 * What the active cell's hint says: why its value doesn't fit (there is no
 * hover on touch), and its rule's prompt. It sits right of the cell, clear
 * of the cells below, or under it when there is no room.
 */
const prompt = computed(() => {
  if (drag.value?.started || panelType.value) return null
  const at = active.value
  const c = checks.value
  const text = c.empty ? undefined : c.ruleAt(at.row, at.col)?.prompt
  let problem: string | undefined
  if (!editing.value) {
    const here = cellView(at.row, at.col, sheet.value.cells[at.row], cols.value.size(at.col))
    if (here.invalid) problem = here.problem
  }
  if (!text && !problem) return null
  const rect = visibleRect(at)
  if (!rect) return null
  const right = rect.x + rect.width + 4
  const room = viewWidth.value - right - 8
  if (room >= HINT_MIN)
    return { text, problem, x: right, y: rect.y, width: Math.min(HINT_WIDTH, room), shift: '' }
  // Under the cell (over it near the bottom), as wide as the view allows; near
  // the right edge it lines up with the cell's right side and reaches left.
  const width = Math.min(HINT_WIDTH, viewWidth.value - 8)
  const fromLeft = rect.x + width <= viewWidth.value - 4
  const x = fromLeft ? Math.max(4, rect.x) : Math.min(rect.x + rect.width, viewWidth.value - 4)
  const below = rect.y + rect.height + 4
  const above = below + HINT_HEIGHT > viewHeight.value && rect.y - HINT_HEIGHT >= headerHeight.value
  const shift = `translate(${fromLeft ? 0 : '-100%'},${above ? '-100%' : 0})`
  return { text, problem, x, y: above ? rect.y - 4 : below, width, shift }
})
// Each line is its own reference, so a screen reader pauses between them.
const describedBy = computed(() => {
  const p = prompt.value
  if (!p) return keysHint
  let ids = keysHint
  if (p.problem) ids += ` ${promptId}-problem`
  if (p.text) ids += ` ${promptId}-text`
  return ids
})

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
  focused,
  messages,
  forEachSelected,
  value: (point) => valueOf(sheet.value.cells[point.row]?.[point.col]),
  result: (point) => resultAt(point.row, point.col),
  cellType: (point) => typeAt(point.row, point.col),
  cellRect: visibleRect,
  rangeRect,
  transact: (run, meta) => transact(run, meta),
  undo: () => travel('undo'),
  redo: () => travel('redo'),
  canUndo,
  canRedo,
  select: (target) => selectTarget(target),
  scrollTo: (target) => scrollToTarget(target),
  edit: (target) => editTarget(target),
  focus: () => focusGrid(),
  showSheet,
  toCSV,
  exportSVG,
  exportPNG,
  print,
  styleAt,
  formatAt,
  styleSelection,
  formatSelection,
  clearFormatting,
  merged,
  canMerge,
  merge: () => mergeSelection(),
  unmerge: () => unmergeSelection(),
  sort: (order) => sortSelection(order),
  filtered: computed(() => !!sheet.value.filter),
  toggleFilter,
  announce,
  editor: {
    cell: computed(() => editing.value),
    text: editText,
    caret: editCaret,
    textAt: (point) => editTextAt(point.row, point.col) ?? '',
    input: inputFrom,
    moveCaret: (caret) => {
      if (!editing.value) return
      if (caret !== editCaret.value) pointing.value = null
      editCaret.value = caret
    },
    key: (event) => {
      const e = editing.value
      if (!e || isComposing(event)) return false
      editKey(event, e.mode)
      return event.defaultPrevented
    },
    commit: (move) => {
      commitEdit(move)
      focusGrid()
    },
    cancel: () => {
      cancelEdit()
      focusGrid()
    },
    attach: (el, options = {}) => {
      editInputs.set(el, options)
      return () => editInputs.delete(el)
    },
    helpId: assistId,
    functions: functionList,
  },
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
  // an extension's history may have come or gone with the list
  syncHistory()
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

function editNoteTarget(target?: SheetCellTarget) {
  const point = target == null ? active.value : toPoint(target)
  if (!point) return
  select(selectCell(clampPoint(point, rowCount.value, colCount.value)))
  editNote()
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
  editNote: editNoteTarget,
  focus: () => focusGrid(),
  showSheet,
  toCSV,
  exportSVG,
  exportPNG,
  print,
  copy: () => copyToClipboard(false),
  cut: () => copyToClipboard(true),
  paste: async (clip) => (clip ? paste(clip) : pasteFromClipboard()),
  findInvalid,
})
</script>

<template>
  <div
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
  >
    <slot name="header" />
    <div class="dou-sheet__frame" :style="`padding:${colOutline}px 0 0 ${rowOutline}px`">
      <div
        v-if="rowOutline && colOutline"
        class="dou-sheet__outline-corner"
        :style="`width:${rowOutline}px;height:${colOutline}px`"
      />
      <SheetOutline
        v-if="rowOutline"
        axis="row"
        :style="`top:${colOutline}px`"
        :groups="groups.rows"
        :summary="groupSummary"
        :lines="rows"
        :frozen="frozen.rows"
        :head="headerHeight"
        :scroll="scroll.top"
        :view="viewHeight - headerHeight - frozenHeight"
        :levels="headers"
        :before="colOutline"
        :label="(g: SheetGroupLines) => groupText('row', g, !g.collapsed)"
        :level-label="(level: number) => format(messages.group.rowLevel, { level })"
        @toggle="(g: SheetGroupLines) => toggleGroup('row', g)"
        @level="(level: number) => showGroupLevel('row', level)"
        @wheel="onOutlineWheel"
      />
      <SheetOutline
        v-if="colOutline"
        axis="col"
        :style="`left:${rowOutline}px`"
        :groups="groups.cols"
        :summary="groupSummary"
        :lines="cols"
        :frozen="frozen.cols"
        :head="headerWidth"
        :scroll="scroll.left"
        :view="viewWidth - headerWidth - frozenWidth"
        :levels="headers"
        :before="rowOutline"
        :label="(g: SheetGroupLines) => groupText('col', g, !g.collapsed)"
        :level-label="(level: number) => format(messages.group.colLevel, { level })"
        @toggle="(g: SheetGroupLines) => toggleGroup('col', g)"
        @level="(level: number) => showGroupLevel('col', level)"
        @wheel="onOutlineWheel"
      />
      <div
        ref="root"
        class="dou-sheet__main"
        @keydown="onKeydown"
        @focusout="onFocusout"
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
          :aria-describedby="describedBy"
          @scroll="onScroll"
          @pointerdown="onPointerDown"
          @click="onClick"
          @dblclick="onDblClick"
          @contextmenu="onContextMenu"
          @pointermove="onHover"
          @pointerleave="onLeave"
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
                  'is-after-hidden': afterHidden('col', col),
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
                  'is-after-hidden': afterHidden('col', col),
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
              v-memo="[
                sheet.cells[row],
                memoBase,
                resultsOf(row),
                rowMarks(row),
                mergeKey(row),
                looksKey(row),
                sheet.validations,
                checksKey(row),
              ]"
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
                  'is-after-hidden': afterHidden('row', row),
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
                :title="cell.problem"
                :aria-invalid="cell.invalid || undefined"
                :style="cell.css"
              >
                <template v-if="cell.render">
                  <span class="dou-sheet__content" aria-hidden="true">
                    <component :is="cell.render" v-bind="cell.props" />
                  </span>
                  <span class="dou-sheet__sr-only">{{ cell.label }}</span>
                </template>
                <span v-else class="dou-sheet__text">{{ cell.text }}</span>
                <span v-if="cell.problem" class="dou-sheet__sr-only">（{{ cell.problem }}）</span>
                <span v-if="cell.invalid" class="dou-sheet__invalid" aria-hidden="true" />
                <template v-if="cell.note">
                  <span class="dou-sheet__noted" aria-hidden="true" />
                  <span v-if="!cell.hidden" class="dou-sheet__sr-only">{{
                    format(messages.note.cellNote, { note: cell.note })
                  }}</span>
                </template>
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
                :title="cell.problem"
                :aria-invalid="cell.invalid || undefined"
                :style="cell.css"
              >
                <template v-if="cell.render">
                  <span class="dou-sheet__content" aria-hidden="true">
                    <component :is="cell.render" v-bind="cell.props" />
                  </span>
                  <span class="dou-sheet__sr-only">{{ cell.label }}</span>
                </template>
                <span v-else class="dou-sheet__text">{{ cell.text }}</span>
                <span v-if="cell.problem" class="dou-sheet__sr-only">（{{ cell.problem }}）</span>
                <span v-if="cell.invalid" class="dou-sheet__invalid" aria-hidden="true" />
                <template v-if="cell.note">
                  <span class="dou-sheet__noted" aria-hidden="true" />
                  <span v-if="!cell.hidden" class="dou-sheet__sr-only">{{
                    format(messages.note.cellNote, { note: cell.note })
                  }}</span>
                </template>
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
              v-memo="[
                sheet.cells[row],
                memoBase,
                resultsOf(row),
                rowMarks(row),
                mergeKey(row),
                looksKey(row),
                sheet.validations,
                checksKey(row),
              ]"
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
                  'is-after-hidden': afterHidden('row', row),
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
                :title="cell.problem"
                :aria-invalid="cell.invalid || undefined"
                :style="cell.css"
              >
                <template v-if="cell.render">
                  <span class="dou-sheet__content" aria-hidden="true">
                    <component :is="cell.render" v-bind="cell.props" />
                  </span>
                  <span class="dou-sheet__sr-only">{{ cell.label }}</span>
                </template>
                <span v-else class="dou-sheet__text">{{ cell.text }}</span>
                <span v-if="cell.problem" class="dou-sheet__sr-only">（{{ cell.problem }}）</span>
                <span v-if="cell.invalid" class="dou-sheet__invalid" aria-hidden="true" />
                <template v-if="cell.note">
                  <span class="dou-sheet__noted" aria-hidden="true" />
                  <span v-if="!cell.hidden" class="dou-sheet__sr-only">{{
                    format(messages.note.cellNote, { note: cell.note })
                  }}</span>
                </template>
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
                :title="cell.problem"
                :aria-invalid="cell.invalid || undefined"
                :style="cell.css"
              >
                <template v-if="cell.render">
                  <span class="dou-sheet__content" aria-hidden="true">
                    <component :is="cell.render" v-bind="cell.props" />
                  </span>
                  <span class="dou-sheet__sr-only">{{ cell.label }}</span>
                </template>
                <span v-else class="dou-sheet__text">{{ cell.text }}</span>
                <span v-if="cell.problem" class="dou-sheet__sr-only">（{{ cell.problem }}）</span>
                <span v-if="cell.invalid" class="dou-sheet__invalid" aria-hidden="true" />
                <template v-if="cell.note">
                  <span class="dou-sheet__noted" aria-hidden="true" />
                  <span v-if="!cell.hidden" class="dou-sheet__sr-only">{{
                    format(messages.note.cellNote, { note: cell.note })
                  }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div
          v-for="mark in refRects"
          :key="mark.key"
          class="dou-sheet__ref"
          :class="`is-ref-${mark.color}`"
          :style="rectStyle(mark.rect)"
          aria-hidden="true"
        />
        <div
          v-if="formulaEdit"
          ref="mirror"
          class="dou-sheet__input is-open is-mirror"
          :class="editorClass"
          :style="inputStyle"
          aria-hidden="true"
        >
          <span v-for="(part, i) in mirrorParts" :key="i" :class="partClass(part)">{{
            part.text
          }}</span>
        </div>
        <textarea
          ref="editor"
          class="dou-sheet__input"
          :class="[editorClass, { 'is-open': editing, 'is-formula': formulaEdit }]"
          :style="inputStyle"
          :aria-label="editing ? format(messages.edit, { cell: formatCell(editing) }) : activeLabel"
          :aria-expanded="panelType ? true : undefined"
          :inputmode="panelType && editByTouch ? 'none' : undefined"
          :aria-activedescendant="
            panel?.activeId ??
            (assist?.kind === 'list' && editInput() === editor
              ? `${assistId}-${assistIndex}`
              : undefined)
          "
          :aria-autocomplete="formulaEdit ? 'list' : undefined"
          :aria-controls="assist ? assistId : undefined"
          :aria-describedby="describedBy"
          :readonly="readonly"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          rows="1"
          @input="onInput"
          @keyup="syncCaret"
          @click="syncCaret"
          @select="syncCaret"
          @scroll="syncMirror"
          @compositionstart="onCompositionStart"
          @focus="focused = true"
          @blur="onInputBlur"
        />
        <div
          v-if="assist"
          :id="assistId"
          class="dou-sheet__assist"
          :role="assist.kind === 'list' ? 'listbox' : 'tooltip'"
          :aria-label="assist.kind === 'list' ? messages.functionList : undefined"
          :style="assistStyle"
          @pointerdown.prevent
        >
          <template v-if="assist.kind === 'list'">
            <div
              v-for="(item, i) in assist.items"
              :id="`${assistId}-${i}`"
              :key="item.name"
              class="dou-sheet__assist-item"
              :class="{ 'is-active': i === assistIndex }"
              role="option"
              :aria-selected="i === assistIndex"
              @pointerenter="assistIndex = i"
              @click="completeName(item)"
            >
              <span class="dou-sheet__assist-name">{{ item.name }}</span>
              <span class="dou-sheet__assist-text">{{ item.description }}</span>
            </div>
          </template>
          <template v-else>
            <div class="dou-sheet__assist-call">
              <span class="dou-sheet__assist-name">{{ assist.name }}</span
              >(<template v-for="(arg, i) in assist.args" :key="i"
                ><template v-if="i">, </template
                ><span :class="{ 'is-current': i === assist.arg }">{{ arg }}</span></template
              >)
            </div>
            <div v-if="assist.description" class="dou-sheet__assist-text">
              {{ assist.description }}
            </div>
          </template>
        </div>
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
        <span
          v-if="noteUnderFill"
          class="dou-sheet__noted is-over-fill"
          :style="`left:${noteUnderFill.x - 8}px;top:${noteUnderFill.y}px`"
          aria-hidden="true"
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
        <div
          v-if="prompt"
          :id="promptId"
          class="dou-sheet__prompt"
          :style="`left:${prompt.x}px;top:${prompt.y}px;max-width:${prompt.width}px;transform:${prompt.shift}`"
        >
          <span
            v-if="prompt.problem"
            :id="`${promptId}-problem`"
            class="dou-sheet__prompt-problem"
            >{{ prompt.problem }}</span
          >
          <span v-if="prompt.text" :id="`${promptId}-text`">{{ prompt.text }}</span>
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
        <DouPopover
          v-for="button in filterButtons"
          :key="button.col"
          :open="filterOpen === button.col"
          trigger="click"
          placement="bottom-end"
          :width="260"
          @update:open="(open: boolean) => (filterOpen = open ? button.col : null)"
        >
          <button
            type="button"
            class="dou-sheet__filter-button"
            :class="{ 'is-active': button.active || button.sorted }"
            :style="`left:${button.x}px;top:${button.y}px`"
            :aria-label="button.label"
            :aria-pressed="button.active"
            tabindex="-1"
            @pointerdown.stop
          >
            <SortAscendingIcon v-if="button.sorted === 'asc' && !button.active" />
            <SortDescendingIcon v-else-if="button.sorted === 'desc' && !button.active" />
            <FilterIcon v-else-if="button.active" />
            <ChevronDownIcon v-else />
          </button>
          <template #content>
            <FilterPanel
              v-if="filterOpen === button.col"
              :values="filterValues.values"
              :numeric="filterValues.numeric"
              :rule="sheet.filter?.columns?.[button.col]"
              :sorted="
                sheet.filter?.sorted?.col === button.col ? sheet.filter.sorted.order : undefined
              "
              :messages="messages"
              :readonly="readonly"
              @sort="(order: SheetSortOrder) => sortFilterColumn(button.col, order)"
              @apply="(rule: SheetFilterRule | undefined) => applyFilter(button.col, rule)"
            />
          </template>
        </DouPopover>
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
        <SheetNote
          v-if="noteShown"
          :key="`${noteShown.row}:${noteShown.col}:${noteShown.by === 'edit'}`"
          :anchor="noteAnchor"
          :note="noteAt(noteShown) ?? ''"
          :editing="noteShown.by === 'edit'"
          :messages="messages.note"
          @save="saveNote"
          @cancel="cancelNote"
          @hover="onNoteHover"
        />
        <component :is="overlay" v-for="(overlay, i) in resolved.overlays" :key="i" />
        <div v-if="notice" class="dou-sheet__notice" role="status">{{ notice }}</div>
        <SheetMenu ref="menu" v-model:open="menuOpen" :items="menuItems" @select="runMenuItem" />
        <span :id="keysHint" class="dou-sheet__sr-only">{{ messages.keys }}</span>
        <div class="dou-sheet__sr-only" aria-live="polite">{{ live }}</div>
      </div>
    </div>
    <slot name="footer" />
  </div>
</template>
