<script setup lang="ts" generic="T">
import type { HTMLAttributes } from 'vue'
import type { ForwardedAttributes } from '../../utils/install'
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  reactive,
  ref,
  shallowRef,
  toDisplayString,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import type { CSSProperties } from 'vue'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FilterIcon,
  GripVerticalIcon,
} from '@dou-ui/icons'
import { useMeasuredSizes } from '../../composables/use-measured-sizes'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import { DouCheckbox } from '../checkbox'
import { DouEmpty } from '../empty'
import { DouPopover } from '../popover'
import { DouSpinner } from '../spinner'
import { createOffsets } from '../virtual-list/virtual-list'
import { useSortable } from '../sortable/use-sortable'
import TableRow, { CellContent } from './table-row'
import type {
  TableColumn,
  TableEmits,
  TableExpose,
  TableProps,
  TableRowDropEvent,
  TableRowKey,
  TableSlots,
  TableSort,
} from './table'

defineOptions({ name: 'DouTable' })

const props = withDefaults(
  defineProps<
    TableProps<T> &
      /* @vue-ignore */ ForwardedAttributes<
        HTMLAttributes,
        TableProps<T>,
        keyof TableEmits & string
      >
  >(),
  {
    rowKey: 'id',
    bordered: false,
    striped: false,
    hoverable: true,
    loading: false,
    selectable: false,
    manualSort: false,
    expandable: false,
    childrenKey: 'children',
    indent: 16,
    resizable: false,
    virtual: false,
    manualFilter: false,
    highlightCurrent: false,
    hasChildrenKey: 'hasChildren',
    draggable: false,
  },
)
const selected = defineModel<TableRowKey[]>('selected', { default: () => [] })
const sort = defineModel<TableSort | null>('sort', { default: null })
const expanded = defineModel<TableRowKey[]>('expanded', { default: () => [] })
const filters = defineModel<Record<string, unknown[]>>('filters', { default: () => ({}) })
const currentKey = defineModel<TableRowKey | null>('current', { default: null })
const columnKeys = defineModel<string[] | undefined>('columnKeys', { default: undefined })
const emit = defineEmits<{
  'update:data': [data: T[]]
  rowDrop: [event: TableRowDropEvent<T>]
  rowClick: [row: T, index: number, event: MouseEvent]
  rowDblclick: [row: T, index: number, event: MouseEvent]
  rowContextmenu: [row: T, index: number, event: MouseEvent]
  cellClick: [row: T, column: TableColumn<T>, event: MouseEvent]
  columnResize: [key: string, width: number]
  loadError: [row: T, error: unknown]
}>()
const slots = defineSlots<TableSlots<T>>()

const ns = useNamespace('table')
const { t, locale } = useLocale()
const size = useFormSize(() => props.size)
const id = `dou-table-${useId()}`

const px = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value

function keyOf(row: T): TableRowKey {
  return typeof props.rowKey === 'function'
    ? props.rowKey(row)
    : ((row as Record<string, unknown>)[props.rowKey] as TableRowKey)
}

function valueOf(row: T, column: TableColumn<T>): unknown {
  return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]
}

// children fetched by `load`, by row key
const loaded = shallowRef(new Map<TableRowKey, T[]>())
const loadingRows = ref(new Set<TableRowKey>())

function childrenOf(row: T): T[] | undefined {
  const children =
    (row as Record<string, unknown>)[props.childrenKey] ?? loaded.value.get(keyOf(row))
  return Array.isArray(children) && children.length > 0 ? (children as T[]) : undefined
}

/** A row whose children are still to be fetched. */
const isLazy = (row: T) =>
  !!props.load &&
  (row as Record<string, unknown>)[props.hasChildrenKey] === true &&
  (row as Record<string, unknown>)[props.childrenKey] === undefined &&
  !loaded.value.has(keyOf(row))

/* columns: groups only have a header, the columns under them show the data */

/** The top-level columns to show, in the order `columnKeys` gives. */
const shown = computed(() => {
  const keys = columnKeys.value
  if (!keys) return props.columns
  const byKey = new Map(props.columns.map((column) => [column.key, column]))
  return keys.flatMap((key) => byKey.get(key) ?? [])
})

const leaves = computed(() => {
  const result: TableColumn<T>[] = []
  const walk = (list: TableColumn<T>[], fixed: TableColumn<T>['fixed']) => {
    for (const column of list) {
      if (column.children?.length) walk(column.children, column.fixed ?? fixed)
      else result.push(fixed && !column.fixed ? { ...column, fixed } : column)
    }
  }
  walk(shown.value, undefined)
  return result
})

interface HeaderCell {
  column: TableColumn<T>
  group: boolean
  colspan: number
  rowspan: number
  /** The first and last data column under it. */
  first: TableColumn<T>
  last: TableColumn<T>
  /** Whether it starts at the table's start edge. */
  edge: boolean
}

const depthOf = (column: TableColumn<T>): number =>
  column.children?.length ? 1 + Math.max(...column.children.map(depthOf)) : 1
const headerDepth = computed(() => Math.max(1, ...shown.value.map(depthOf)))
const grouped = computed(() => headerDepth.value > 1)

const headerRows = computed(() => {
  const rows: HeaderCell[][] = Array.from({ length: headerDepth.value }, () => [])
  let position = 0
  const walk = (list: TableColumn<T>[], level: number) => {
    for (const column of list) {
      const start = position
      if (column.children?.length) walk(column.children, level + 1)
      else position++
      const span = leaves.value.slice(start, position)
      if (span.length === 0) continue
      rows[level]!.push({
        column: column.children?.length ? column : span[0]!,
        group: !!column.children?.length,
        colspan: span.length,
        rowspan: column.children?.length ? 1 : headerDepth.value - level,
        first: span[0]!,
        last: span.at(-1)!,
        edge: start === 0,
      })
    }
  }
  walk(shown.value, 0)
  return rows
})

/* filtering: a row stays when it passes, or when one of its children does */

const activeFilters = computed(() =>
  props.manualFilter
    ? []
    : leaves.value.filter((column) => column.filters?.length && filters.value[column.key]?.length),
)

function passes(row: T) {
  return activeFilters.value.every((column) =>
    filters.value[column.key]!.some((value) =>
      column.filterMethod
        ? column.filterMethod(value, row)
        : Object.is(valueOf(row, column), value),
    ),
  )
}

const passing = computed(() => {
  if (activeFilters.value.length === 0) return undefined
  const result = new Set<T>()
  const walk = (list: T[]): boolean => {
    let any = false
    for (const row of list) {
      const children = childrenOf(row)
      const child = children ? walk(children) : false
      if (child || passes(row)) {
        result.add(row)
        any = true
      }
    }
    return any
  }
  walk(props.data)
  return result
})
const visible = (list: T[]) =>
  passing.value ? list.filter((row) => passing.value!.has(row)) : list

/** Numbers by value, everything else by its text in the page's language. */
function compareValues(a: unknown, b: unknown, name: string): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), name, { numeric: true })
}

// sorting: every level of a tree is sorted among its siblings
const sorter = computed(() => {
  const current = sort.value
  const column = current && leaves.value.find((col) => col.key === current.key)
  if (props.manualSort || !current || !column?.sortable) return undefined
  const direction = current.order === 'desc' ? -1 : 1
  const compare =
    typeof column.sortable === 'function'
      ? column.sortable
      : (a: T, b: T) => compareValues(valueOf(a, column), valueOf(b, column), locale.value.name)
  return (a: T, b: T) => compare(a, b) * direction
})

function sorted(rows: T[]): T[] {
  const compare = sorter.value
  // Sorting is stable, so equal rows keep the order they came in.
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  return compare ? [...rows].sort(compare) : rows
}

function toggleSort(column: TableColumn<T>) {
  const current = sort.value?.key === column.key ? sort.value.order : undefined
  // ascending → descending → unsorted
  if (current === undefined) sort.value = { key: column.key, order: 'asc' }
  else if (current === 'asc') sort.value = { key: column.key, order: 'desc' }
  else sort.value = null
}

function ariaSort(column: TableColumn<T>) {
  if (!column.sortable) return undefined
  if (sort.value?.key !== column.key) return 'none'
  return sort.value.order === 'asc' ? 'ascending' : 'descending'
}

// tree and detail rows
const expandedSet = computed(() => new Set(expanded.value))
const isTree = computed(() => props.data.some((row) => !!childrenOf(row) || isLazy(row)))
const hasExpand = computed(
  () => props.expandable !== false && (!props.virtual || props.rowHeight === undefined),
)
const canExpand = (row: T) =>
  typeof props.expandable === 'function' ? props.expandable(row) : !!props.expandable

function setExpanded(key: TableRowKey, open: boolean) {
  if (open === expandedSet.value.has(key)) return
  expanded.value = open ? [...expanded.value, key] : expanded.value.filter((item) => item !== key)
}

function toggleExpanded(key: TableRowKey) {
  setExpanded(key, !expandedSet.value.has(key))
}

async function toggleTree(item: FlatRow) {
  if (expandedSet.value.has(item.key) || !isLazy(item.row)) return toggleExpanded(item.key)
  if (loadingRows.value.has(item.key)) return
  loadingRows.value = new Set(loadingRows.value).add(item.key)
  try {
    const children = await props.load!(item.row)
    loaded.value = new Map(loaded.value).set(item.key, children)
    setExpanded(item.key, true)
  } catch (error) {
    emit('loadError', item.row, error)
  } finally {
    const next = new Set(loadingRows.value)
    next.delete(item.key)
    loadingRows.value = next
  }
}

interface FlatRow {
  row: T
  key: TableRowKey
  level: number
  /** Position among the rendered rows, counting from 0. */
  index: number
  parent: boolean
}

const rows = computed<FlatRow[]>(() => {
  const result: FlatRow[] = []
  const walk = (list: T[], level: number) => {
    for (const row of sorted(visible(list))) {
      const key = keyOf(row)
      const children = childrenOf(row)
      result.push({ row, key, level, index: result.length, parent: !!children || isLazy(row) })
      if (children && expandedSet.value.has(key)) walk(children, level + 1)
    }
  }
  walk(dragActive.value ? sortable.list.value : props.data, 1)
  return result
})

/** Every row that passes the filters, collapsed tree rows included. */
const allRows = computed(() => {
  const result: T[] = []
  const walk = (list: T[]) => {
    for (const row of visible(list)) {
      result.push(row)
      const children = childrenOf(row)
      if (children) walk(children)
    }
  }
  walk(props.data)
  return result
})

// selection
const selectedSet = computed(() => new Set(selected.value))
const canSelect = (row: T) =>
  typeof props.selectable === 'function' ? props.selectable(row) : !!props.selectable
const selectableKeys = computed(() => allRows.value.filter(canSelect).map(keyOf))
const selectedCount = computed(
  () => selectableKeys.value.filter((key) => selectedSet.value.has(key)).length,
)
const allSelected = computed(
  () => selectableKeys.value.length > 0 && selectedCount.value === selectableKeys.value.length,
)
const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value)

function toggleAll(checked: boolean) {
  const keys = new Set(selectableKeys.value)
  // Rows that are selected but cannot be toggled here stay selected.
  const kept = selected.value.filter((key) => !keys.has(key))
  selected.value = checked ? [...kept, ...selectableKeys.value] : kept
}

function toggleRow(row: T, checked: boolean) {
  const key = keyOf(row)
  selected.value = checked
    ? [...selected.value.filter((item) => item !== key), key]
    : selected.value.filter((item) => item !== key)
}

const hasSelection = computed(() => props.selectable !== false)
const hasDrag = computed(() => props.draggable)
const utilityCount = computed(
  () => (hasDrag.value ? 1 : 0) + (hasExpand.value ? 1 : 0) + (hasSelection.value ? 1 : 0),
)
// the utility columns, in order: drag handle, detail toggle, checkbox
const expandAt = computed(() => (hasDrag.value ? 1 : 0))
const selectionAt = computed(() => expandAt.value + (hasExpand.value ? 1 : 0))

/* dragging rows: reorders `data` as given, so not while sorted, filtered or a tree */

const dragActive = computed(
  () => hasDrag.value && !sorter.value && !passing.value && !isTree.value && !props.virtual,
)
const sortable = useSortable<T>({
  items: computed({
    get: () => props.data,
    set: (value) => emit('update:data', value),
  }),
  key: keyOf,
  handle: () => true,
  disabled: () => !dragActive.value,
  label: (_row, index) => t('sortable.position', { n: index + 1 }),
  messages: () => ({
    item: t('sortable.item'),
    lifted: (label, position, total) => t('sortable.lifted', { label, position, total }),
    moved: (label, position, total) => t('sortable.moved', { label, position, total }),
    dropped: (label, position, total) => t('sortable.dropped', { label, position, total }),
    canceled: (label) => t('sortable.canceled', { label }),
  }),
  ghost: rowGhost,
  onSort: ({ item, oldIndex, newIndex }) => emit('rowDrop', { row: item, oldIndex, newIndex }),
})

/** A dragged row follows the pointer inside a one-row copy of the table, cells at their widths. */
function rowGhost(tr: HTMLElement) {
  const frame = document.createElement('div')
  frame.className = classes.value
    .filter((name): name is string => typeof name === 'string' && name.startsWith(ns.b()))
    .join(' ')
  frame.classList.add(ns.e('ghost'))
  const table = document.createElement('table')
  table.className = ns.e('table')
  const body = document.createElement('tbody')
  body.className = ns.e('body')
  const row = tr.cloneNode(true) as HTMLElement
  row.removeAttribute('data-dou-sortable-key')
  row.classList.remove('is-dragging')
  const cells = tr.children
  ;[...row.children].forEach((cell, at) => {
    const width = cells[at]?.getBoundingClientRect().width
    if (width) (cell as HTMLElement).style.width = `${width}px`
  })
  body.append(row)
  table.append(body)
  frame.append(table)
  return frame
}
const span = computed(() => leaves.value.length + utilityCount.value)

// widths: resized columns keep their width in px
const UTILITY_WIDTH = 40
const resizedWidths = reactive<Record<string, number>>({})
const resized = ref(false)
const widthOf = (column: TableColumn<T>) => resizedWidths[column.key] ?? column.width
const numericWidth = (column: TableColumn<T>) => {
  const width = widthOf(column)
  if (typeof width === 'number') return width
  return typeof column.minWidth === 'number' ? column.minWidth : 120
}
const isResizable = (column: TableColumn<T>) => column.resizable ?? props.resizable

// fixed columns stick at the summed widths of the fixed columns before them
const hasFixedStart = computed(() => leaves.value.some((column) => column.fixed === 'start'))
const hasFixed = computed(() => leaves.value.some((column) => column.fixed))
const fixedOffsets = computed(() => {
  const offsets = new Map<string, { side: 'start' | 'end'; offset: number; edge: boolean }>()
  let start = hasFixedStart.value ? utilityCount.value * UTILITY_WIDTH : 0
  const starts = leaves.value.filter((column) => column.fixed === 'start')
  for (const column of starts) {
    offsets.set(column.key, { side: 'start', offset: start, edge: column === starts.at(-1) })
    start += numericWidth(column)
  }
  let end = 0
  const ends = leaves.value.filter((column) => column.fixed === 'end')
  for (let i = ends.length - 1; i >= 0; i--) {
    const column = ends[i]!
    offsets.set(column.key, { side: 'end', offset: end, edge: column === ends[0] })
    end += numericWidth(column)
  }
  return offsets
})

function fixedStyle(column: TableColumn<T>): CSSProperties | undefined {
  const fixed = fixedOffsets.value.get(column.key)
  if (!fixed) return undefined
  return fixed.side === 'start'
    ? { insetInlineStart: `${fixed.offset}px` }
    : { insetInlineEnd: `${fixed.offset}px` }
}

function fixedClass(column: TableColumn<T>) {
  const fixed = fixedOffsets.value.get(column.key)
  if (!fixed) return undefined
  return [ns.is(`fixed-${fixed.side}`, true), ns.is(`fixed-${fixed.side}-edge`, fixed.edge)]
}

/** The utility columns stick with the fixed start columns, side by side. */
const utilityStyles = computed(() =>
  Array.from({ length: utilityCount.value }, (_, position) =>
    hasFixedStart.value
      ? {
          class: [
            ns.is('fixed-start', true),
            ns.is(
              'fixed-start-edge',
              position === utilityCount.value - 1 && !leaves.value.some((c) => c.fixed === 'start'),
            ),
          ],
          style: { insetInlineStart: `${position * UTILITY_WIDTH}px` },
        }
      : { class: undefined, style: undefined },
  ),
)
const noFixed = { class: undefined, style: undefined }
const utilityFixed = (position: number) => utilityStyles.value[position] ?? noFixed

// horizontal and vertical scrolling
const wrapper = useTemplateRef<HTMLElement>('wrapper')
const tableEl = useTemplateRef<HTMLElement>('table')
const scrollTop = ref(0)
const shadowStart = ref(false)
const shadowEnd = ref(false)
const viewport = ref(0)

function measureScroll() {
  const el = wrapper.value
  if (!el) return
  scrollTop.value = el.scrollTop
  viewport.value = el.clientHeight
  const max = el.scrollWidth - el.clientWidth
  // `scrollLeft` is negative in right-to-left pages.
  const left = Math.abs(el.scrollLeft)
  shadowStart.value = left > 0
  shadowEnd.value = left < max - 1
}

const observer = shallowRef<ResizeObserver>()
onMounted(() => {
  measureScroll()
  if (typeof ResizeObserver === 'undefined' || !wrapper.value) return
  observer.value = new ResizeObserver(measureScroll)
  observer.value.observe(wrapper.value)
  if (tableEl.value) observer.value.observe(tableEl.value)
})
onBeforeUnmount(() => observer.value?.disconnect())

// virtual rows: only those in view, with spacers standing in for the rest.
// Without `rowHeight`, rows are measured once rendered, detail rows included.
const fixedRows = computed(() => props.virtual && props.rowHeight !== undefined)
const rowHeight = computed(
  () => props.rowHeight ?? { sm: 36, md: 44, lg: 52 }[size.value as 'sm' | 'md' | 'lg'] ?? 44,
)
const rowSizes = useMeasuredSizes({
  count: () => rows.value.length,
  keyOf: (index) => rows.value[index]!.key,
  estimate: () => rowHeight.value,
  container: () => wrapper.value,
})
const fixedRowOffsets = computed(() => createOffsets(rows.value.length, () => rowHeight.value))
const rowOffsets = computed(() =>
  fixedRows.value ? fixedRowOffsets.value : rowSizes.offsets.value,
)
const OVERSCAN = 6
const fallbackViewport = computed(() =>
  typeof props.maxHeight === 'number' ? props.maxHeight : 400,
)
const range = computed(() => {
  const count = rows.value.length
  if (!props.virtual || !count) return { from: 0, to: count }
  const { find } = rowOffsets.value
  const view = viewport.value || fallbackViewport.value
  return {
    from: Math.max(0, find(scrollTop.value) - OVERSCAN),
    to: Math.min(count, find(scrollTop.value + view) + 1 + OVERSCAN),
  }
})
const visibleRows = computed(() => rows.value.slice(range.value.from, range.value.to))
const spacerBefore = computed(() => rowOffsets.value.start(range.value.from))
const spacerAfter = computed(() => rowOffsets.value.total - rowOffsets.value.start(range.value.to))
const measuredRows = computed(() => props.virtual && !fixedRows.value)
const trackRow = (el: unknown, item: FlatRow, position: number) =>
  rowSizes.track(el as Element | null, item.key, range.value.from + position)
// A closed detail row leaves its row shorter.
onUpdated(rowSizes.prune)
watch(expandedSet, () => void nextTick(rowSizes.prune))
watch(
  () => props.data,
  () => {
    // Fewer rows can leave the scroll position past the end.
    if (props.virtual) void nextTick(measureScroll)
  },
)

// column resizing
const MIN_WIDTH = 48
const minWidthOf = (column: TableColumn<T>) =>
  typeof column.minWidth === 'number' ? Math.max(column.minWidth, MIN_WIDTH) : MIN_WIDTH

/** Pin every column at its rendered width before the first resize, so only the dragged one moves. */
function freezeWidths() {
  if (resized.value) return
  const cells = tableEl.value?.querySelectorAll<HTMLElement>(`thead > tr > th[data-column-key]`)
  const measured = new Map<string, number>()
  for (const cell of cells ?? [])
    measured.set(cell.dataset.columnKey!, cell.getBoundingClientRect().width)
  for (const column of leaves.value) {
    // Not laid out (e.g. hidden): fall back to the declared width.
    resizedWidths[column.key] ??= measured.get(column.key) || numericWidth(column)
  }
  resized.value = true
}

function setWidth(column: TableColumn<T>, width: number) {
  resizedWidths[column.key] = Math.max(minWidthOf(column), Math.round(width))
}

function onResizeStart(event: PointerEvent, column: TableColumn<T>) {
  if (event.button !== 0) return
  event.preventDefault()
  freezeWidths()
  const handle = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startWidth = numericWidth(column)
  const rtl = getComputedStyle(handle).direction === 'rtl'
  handle.setPointerCapture?.(event.pointerId)
  const move = (moveEvent: PointerEvent) => {
    const delta = (moveEvent.clientX - startX) * (rtl ? -1 : 1)
    setWidth(column, startWidth + delta)
  }
  const up = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
    handle.removeEventListener('pointercancel', up)
    emit('columnResize', column.key, numericWidth(column))
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
  handle.addEventListener('pointercancel', up)
}

function onResizeKey(event: KeyboardEvent, column: TableColumn<T>) {
  const step = event.shiftKey ? 32 : 8
  const delta = { ArrowRight: step, ArrowLeft: -step }[event.key]
  if (delta === undefined) return
  event.preventDefault()
  freezeWidths()
  const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === 'rtl'
  setWidth(column, numericWidth(column) + (rtl ? -delta : delta))
  emit('columnResize', column.key, numericWidth(column))
}

const tableStyle = computed(() => {
  if (!resized.value) {
    // columns with a minimum width in px keep it: narrow tables scroll instead of squeezing them
    if (!leaves.value.some((column) => typeof column.minWidth === 'number')) return undefined
    const least =
      leaves.value.reduce(
        (sum, column) => sum + (typeof column.minWidth === 'number' ? column.minWidth : 0),
        0,
      ) +
      utilityCount.value * UTILITY_WIDTH
    return { minWidth: `${least}px` }
  }
  const total =
    leaves.value.reduce((sum, column) => sum + numericWidth(column), 0) +
    utilityCount.value * UTILITY_WIDTH
  return { width: `${total}px` }
})

// summary
const summaryValues = computed(() => (props.summary ? props.summary(allRows.value) : undefined))

const wrapperStyle = computed(() =>
  props.maxHeight === undefined ? undefined : { maxHeight: px(props.maxHeight) },
)

const fixedLayout = computed(
  () => props.virtual || hasFixed.value || props.resizable || leaves.value.some(isResizable),
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('bordered', props.bordered),
  ns.is('striped', props.striped),
  ns.is('hoverable', props.hoverable),
  ns.is('loading', props.loading),
  ns.is('scroll', props.maxHeight !== undefined),
  ns.is('fixed-layout', fixedLayout.value),
  ns.is('virtual', props.virtual),
  ns.is('fixed-rows', fixedRows.value),
  ns.is('grouped', grouped.value),
  ns.is('spanning', !!spans.value),
  ns.is('highlight-current', props.highlightCurrent),
  ns.is('shadow-start', shadowStart.value),
  ns.is('shadow-end', shadowEnd.value),
])

const alignClass = (column: TableColumn<T>) =>
  column.align && column.align !== 'start' && ns.is(column.align)

/** The classes and styles of each column's body cells, the same on every row. */
const cellMeta = computed(() =>
  leaves.value.map((column, columnIndex) => ({
    class: [
      ns.e('cell'),
      alignClass(column),
      ns.is('ellipsis', !!column.ellipsis),
      ns.is('edge', columnIndex === 0 && utilityCount.value === 0),
      fixedClass(column),
    ],
    style: fixedStyle(column),
  })),
)

const treeColumnKey = computed(() => (isTree.value ? leaves.value[0]?.key : undefined))

/* body rows */

// Rows skip redrawing when their props stay the same. That is only safe
// while the slots they render are the compiled, stable kind: any other
// slots may have changed with the parent, so every row redraws then.
const instance = getCurrentInstance()!
let renderedVnode = instance.vnode
let version = 0
function slotVersion() {
  if (instance.vnode !== renderedVnode) {
    renderedVnode = instance.vnode
    const own = instance.slots as { _?: number }
    if (own._ !== 1 && Object.keys(own).length > 0) version++
  }
  return version
}

function rowClassOf(item: FlatRow, isSelected: boolean, isExpanded: boolean, isCurrent: boolean) {
  const extra =
    typeof props.rowClass === 'function' ? props.rowClass(item.row, item.index) : props.rowClass
  return [
    ns.e('row'),
    ns.is('even', item.index % 2 === 1),
    ns.is('selected', isSelected),
    ns.is('expanded', isExpanded),
    ns.is('current', isCurrent),
    extra,
  ]
}

/** Whether a column's cells come from a slot rather than the plain value. */
const hasCellSlot = (column: TableColumn<T>) => !!slots.cell || `cell-${column.key}` in slots

/**
 * A cell's content: its column's slot, the shared `cell` slot, or the value.
 * Called from the row rather than through `<slot>`, so rows keep stable slots.
 */
function cellContent(item: FlatRow, column: TableColumn<T>) {
  const scope = { row: item.row, column, value: valueOf(item.row, column), index: item.index }
  const own = (slots as Record<string, ((scope: unknown) => unknown) | undefined>)[
    `cell-${column.key}`
  ]
  if (own) return own(scope)
  if (slots.cell) return slots.cell(scope)
  return toDisplayString(scope.value ?? '')
}

function rowStyleOf(item: FlatRow): CSSProperties[] {
  const extra =
    typeof props.rowStyle === 'function' ? props.rowStyle(item.row, item.index) : props.rowStyle
  const list: CSSProperties[] = []
  if (fixedRows.value) list.push({ height: `${rowHeight.value}px` })
  if (extra) list.push(extra)
  return list
}

function onRowClick(item: FlatRow, event: MouseEvent) {
  if (props.highlightCurrent) currentKey.value = item.key
  emit('rowClick', item.row, item.index, event)
}

// merged cells: the spans of every rendered cell, `[rowspan, colspan]`
const spans = computed(() => {
  const method = props.spanMethod
  if (!method || props.virtual) return undefined
  return visibleRows.value.map((item) =>
    leaves.value.map((column, columnIndex): [number, number] => {
      const result = method({ row: item.row, column, rowIndex: item.index, columnIndex })
      if (!result) return [1, 1]
      if (Array.isArray(result)) return [result[0], result[1]]
      return [result.rowspan ?? 1, result.colspan ?? 1]
    }),
  )
})
const spanOf = (position: number, columnIndex: number) =>
  spans.value?.[position]?.[columnIndex] ?? ([1, 1] as [number, number])

/* header filters */

const filterOpen = ref<string | null>(null)
const filterDraft = ref<unknown[]>([])
const isFiltered = (column: TableColumn<T>) => !!filters.value[column.key]?.length

function onFilterOpen(column: TableColumn<T>, open: boolean) {
  filterOpen.value = open ? column.key : filterOpen.value === column.key ? null : filterOpen.value
  if (open) filterDraft.value = [...(filters.value[column.key] ?? [])]
}

function setFilter(key: string, values: unknown[]) {
  const next = { ...filters.value }
  if (values.length) next[key] = values
  else delete next[key]
  filters.value = next
}

function toggleDraft(value: unknown, checked: boolean) {
  filterDraft.value = checked
    ? [...filterDraft.value, value]
    : filterDraft.value.filter((item) => !Object.is(item, value))
}

function applyFilter(column: TableColumn<T>, values = filterDraft.value) {
  setFilter(column.key, values)
  filterOpen.value = null
}

/* methods */

function pathTo(key: TableRowKey): T[] | undefined {
  const walk = (list: T[], path: T[]): T[] | undefined => {
    for (const row of list) {
      if (keyOf(row) === key) return path
      const children = childrenOf(row)
      const found = children && walk(children, [...path, row])
      if (found) return found
    }
  }
  return walk(props.data, [])
}

async function scrollToRow(key: TableRowKey) {
  const ancestors = pathTo(key)
  if (!ancestors) return
  for (const row of ancestors) setExpanded(keyOf(row), true)
  await nextTick()
  const el = wrapper.value
  if (!el) return
  if (props.virtual) {
    const index = rows.value.findIndex((item) => item.key === key)
    if (index < 0) return
    el.scrollTop = rowOffsets.value.start(index)
    measureScroll()
    // Measured rows land where estimated; align on the rendered row.
    if (fixedRows.value) return
    await nextTick()
  }
  const row = [...el.querySelectorAll<HTMLElement>('tr[data-row-key]')].find(
    (tr) => tr.dataset.rowKey === String(key),
  )
  if (!row) return
  const head = tableEl.value?.querySelector('thead')?.getBoundingClientRect().height ?? 0
  el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - head
}

defineExpose<TableExpose>({
  scrollToRow: (key) => void scrollToRow(key),
  scrollTo: (top) => wrapper.value?.scrollTo({ top }),
  toggleRowSelection: (key, value) => {
    const on = value ?? !selectedSet.value.has(key)
    selected.value = on
      ? [...selected.value.filter((item) => item !== key), key]
      : selected.value.filter((item) => item !== key)
  },
  clearSelection: () => (selected.value = []),
  toggleRowExpansion: (key, value) => setExpanded(key, value ?? !expandedSet.value.has(key)),
  clearSort: () => (sort.value = null),
  clearFilters: (key) => (key === undefined ? (filters.value = {}) : setFilter(key, [])),
  setCurrent: (key) => (currentKey.value = key),
})
</script>

<template>
  <div :class="classes">
    <div
      ref="wrapper"
      :class="ns.e('wrapper')"
      :style="wrapperStyle"
      :tabindex="maxHeight === undefined ? undefined : 0"
      @scroll="measureScroll"
    >
      <table
        ref="table"
        :class="ns.e('table')"
        :style="tableStyle"
        :aria-busy="loading || undefined"
        :aria-rowcount="virtual ? rows.length + headerDepth : undefined"
      >
        <colgroup>
          <col v-if="hasDrag" :class="ns.e('col-utility')" />
          <col v-if="hasExpand" :class="ns.e('col-utility')" />
          <col v-if="hasSelection" :class="ns.e('col-utility')" />
          <col
            v-for="column in leaves"
            :key="column.key"
            :style="{ width: px(widthOf(column)), minWidth: px(column.minWidth) }"
          />
        </colgroup>
        <thead :class="ns.e('head')">
          <tr
            v-for="(cells, level) in headerRows"
            :key="level"
            :aria-rowindex="virtual ? level + 1 : undefined"
          >
            <template v-if="level === 0">
              <th
                v-if="hasDrag"
                :rowspan="headerDepth"
                :class="[ns.e('cell'), ns.e('drag'), ns.is('edge', true), utilityFixed(0).class]"
                :style="utilityFixed(0).style"
                scope="col"
              >
                <span :class="ns.e('visually-hidden')">{{ t('table.drag') }}</span>
              </th>
              <th
                v-if="hasExpand"
                :rowspan="headerDepth"
                :class="[
                  ns.e('cell'),
                  ns.e('expand'),
                  ns.is('edge', !hasDrag),
                  utilityFixed(expandAt).class,
                ]"
                :style="utilityFixed(expandAt).style"
                scope="col"
              >
                <span :class="ns.e('visually-hidden')">{{ t('table.expand') }}</span>
              </th>
              <th
                v-if="hasSelection"
                :rowspan="headerDepth"
                :class="[
                  ns.e('cell'),
                  ns.e('selection'),
                  ns.is('edge', selectionAt === 0),
                  utilityFixed(selectionAt).class,
                ]"
                :style="utilityFixed(selectionAt).style"
                scope="col"
              >
                <DouCheckbox
                  :model-value="allSelected"
                  :indeterminate="someSelected"
                  :disabled="selectableKeys.length === 0"
                  size="sm"
                  :aria-label="t('table.selectAll')"
                  @update:model-value="toggleAll"
                />
              </th>
            </template>
            <template v-for="cell in cells" :key="cell.column.key">
              <th
                v-if="cell.group"
                :colspan="cell.colspan"
                :class="[
                  ns.e('cell'),
                  ns.e('group'),
                  alignClass(cell.column),
                  ns.is('edge', cell.edge && utilityCount === 0),
                  cell.first.fixed === cell.last.fixed &&
                    fixedClass(cell.first.fixed === 'end' ? cell.last : cell.first),
                ]"
                :style="[
                  { '--dou-table-head-level': level },
                  cell.first.fixed === cell.last.fixed
                    ? fixedStyle(cell.first.fixed === 'end' ? cell.last : cell.first)
                    : undefined,
                ]"
                scope="colgroup"
              >
                <span :class="ns.e('title')">
                  <slot :name="`header-${cell.column.key}`" :column="cell.column">
                    <slot name="header" :column="cell.column">{{ cell.column.title }}</slot>
                  </slot>
                </span>
              </th>
              <th
                v-else
                :rowspan="cell.rowspan"
                :data-column-key="cell.column.key"
                :class="[
                  ns.e('cell'),
                  alignClass(cell.column),
                  ns.is('sortable', !!cell.column.sortable),
                  ns.is('edge', cell.edge && utilityCount === 0),
                  fixedClass(cell.column),
                ]"
                :style="[
                  { minWidth: px(cell.column.minWidth), '--dou-table-head-level': level },
                  fixedStyle(cell.column),
                ]"
                scope="col"
                :aria-sort="ariaSort(cell.column)"
              >
                <span :class="ns.e('head-content')">
                  <button
                    v-if="cell.column.sortable"
                    type="button"
                    :class="[ns.e('sorter'), ns.is('sorted', sort?.key === cell.column.key)]"
                    @click="toggleSort(cell.column)"
                  >
                    <span :class="ns.e('title')">
                      <slot :name="`header-${cell.column.key}`" :column="cell.column">
                        <slot name="header" :column="cell.column">{{ cell.column.title }}</slot>
                      </slot>
                    </span>
                    <span
                      :class="[
                        ns.e('sort-icon'),
                        sort?.key === cell.column.key && ns.is(sort.order),
                      ]"
                      aria-hidden="true"
                    >
                      <ChevronUpIcon :class="ns.e('sort-asc')" />
                      <ChevronDownIcon :class="ns.e('sort-desc')" />
                    </span>
                  </button>
                  <span v-else :class="ns.e('title')">
                    <slot :name="`header-${cell.column.key}`" :column="cell.column">
                      <slot name="header" :column="cell.column">{{ cell.column.title }}</slot>
                    </slot>
                  </span>
                  <DouPopover
                    v-if="cell.column.filters?.length"
                    :open="filterOpen === cell.column.key"
                    placement="bottom-start"
                    :offset="6"
                    @update:open="onFilterOpen(cell.column, $event)"
                  >
                    <button
                      type="button"
                      :class="[ns.e('filter-trigger'), ns.is('active', isFiltered(cell.column))]"
                      :aria-label="
                        t('table.filter', { column: cell.column.title ?? cell.column.key })
                      "
                    >
                      <FilterIcon />
                    </button>
                    <template #content>
                      <div v-if="cell.column.filterMultiple !== false" :class="ns.e('filter')">
                        <div :class="ns.e('filter-list')">
                          <DouCheckbox
                            v-for="option in cell.column.filters"
                            :key="String(option.value)"
                            size="sm"
                            :model-value="
                              filterDraft.some((value) => Object.is(value, option.value))
                            "
                            @update:model-value="toggleDraft(option.value, $event)"
                          >
                            {{ option.label }}
                          </DouCheckbox>
                        </div>
                        <div :class="ns.e('filter-footer')">
                          <DouButton
                            variant="ghost"
                            size="sm"
                            :disabled="filterDraft.length === 0"
                            @click="applyFilter(cell.column, [])"
                          >
                            {{ t('table.filterReset') }}
                          </DouButton>
                          <DouButton size="sm" @click="applyFilter(cell.column)">
                            {{ t('table.filterConfirm') }}
                          </DouButton>
                        </div>
                      </div>
                      <div v-else :class="[ns.e('filter'), ns.e('filter-list')]" role="menu">
                        <button
                          type="button"
                          role="menuitemradio"
                          :aria-checked="!isFiltered(cell.column)"
                          :class="[
                            ns.e('filter-option'),
                            ns.is('selected', !isFiltered(cell.column)),
                          ]"
                          @click="applyFilter(cell.column, [])"
                        >
                          {{ t('table.filterAll') }}
                        </button>
                        <button
                          v-for="option in cell.column.filters"
                          :key="String(option.value)"
                          type="button"
                          role="menuitemradio"
                          :aria-checked="Object.is(filters[cell.column.key]?.[0], option.value)"
                          :class="[
                            ns.e('filter-option'),
                            ns.is(
                              'selected',
                              Object.is(filters[cell.column.key]?.[0], option.value),
                            ),
                          ]"
                          @click="applyFilter(cell.column, [option.value])"
                        >
                          {{ option.label }}
                        </button>
                      </div>
                    </template>
                  </DouPopover>
                </span>
                <span
                  v-if="isResizable(cell.column)"
                  :class="ns.e('resizer')"
                  role="separator"
                  aria-orientation="vertical"
                  tabindex="0"
                  :aria-label="t('table.resize', { column: cell.column.title ?? cell.column.key })"
                  :aria-valuenow="Math.round(numericWidth(cell.column))"
                  :aria-valuemin="minWidthOf(cell.column)"
                  @pointerdown="onResizeStart($event, cell.column)"
                  @keydown="onResizeKey($event, cell.column)"
                  @click.stop
                />
              </th>
            </template>
          </tr>
        </thead>
        <tbody
          :ref="(el) => (sortable.container.value = el as HTMLElement | null)"
          :class="ns.e('body')"
          v-bind="hasDrag ? sortable.listAttrs.value : undefined"
        >
          <tr v-if="virtual && spacerBefore > 0" :class="ns.e('spacer')" aria-hidden="true">
            <td :colspan="span" :style="{ height: `${spacerBefore}px` }" />
          </tr>
          <TableRow
            v-for="(entry, at) in visibleRows"
            :key="entry.key"
            v-slot="{
              item,
              position,
              selected: rowSelected,
              expanded: rowExpanded,
              current: rowCurrent,
              loading: rowLoading,
            }"
            :row="entry.row"
            :row-key="entry.key"
            :level="entry.level"
            :index="entry.index"
            :parent="entry.parent"
            :position="at"
            :selected="hasSelection && selectedSet.has(entry.key)"
            :expanded="expandedSet.has(entry.key)"
            :current="highlightCurrent && currentKey === entry.key"
            :loading="loadingRows.has(entry.key)"
            :version="slotVersion()"
          >
            <tr
              :ref="measuredRows ? (el) => trackRow(el, item, position) : undefined"
              :class="rowClassOf(item, rowSelected, rowExpanded, rowCurrent)"
              :style="rowStyleOf(item)"
              :data-row-key="item.key"
              :aria-rowindex="virtual ? item.index + 1 + headerDepth : undefined"
              :aria-selected="highlightCurrent ? rowCurrent : undefined"
              v-bind="hasDrag ? sortable.itemAttrs(item.row, item.index) : undefined"
              @click="onRowClick(item, $event)"
              @dblclick="emit('rowDblclick', item.row, item.index, $event)"
              @contextmenu="emit('rowContextmenu', item.row, item.index, $event)"
            >
              <td
                v-if="hasDrag"
                :class="[ns.e('cell'), ns.e('drag'), ns.is('edge', true), utilityFixed(0).class]"
                :style="utilityFixed(0).style"
                @click.stop
              >
                <button
                  type="button"
                  :class="ns.e('drag-handle')"
                  data-dou-sortable-handle
                  :disabled="!dragActive"
                  :aria-label="t('table.dragRow')"
                  :aria-description="t('sortable.hint')"
                >
                  <GripVerticalIcon />
                </button>
              </td>
              <td
                v-if="hasExpand"
                :class="[
                  ns.e('cell'),
                  ns.e('expand'),
                  ns.is('edge', !hasDrag),
                  utilityFixed(expandAt).class,
                ]"
                :style="utilityFixed(expandAt).style"
                @click.stop
              >
                <button
                  v-if="canExpand(item.row)"
                  type="button"
                  :class="[ns.e('toggle'), ns.is('open', rowExpanded)]"
                  :aria-expanded="rowExpanded"
                  :aria-controls="rowExpanded ? `${id}-${item.key}` : undefined"
                  :aria-label="t('table.expandRow')"
                  @click="toggleExpanded(item.key)"
                >
                  <ChevronRightIcon />
                </button>
              </td>
              <td
                v-if="hasSelection"
                :class="[
                  ns.e('cell'),
                  ns.e('selection'),
                  ns.is('edge', selectionAt === 0),
                  utilityFixed(selectionAt).class,
                ]"
                :style="utilityFixed(selectionAt).style"
                @click.stop
              >
                <DouCheckbox
                  :model-value="rowSelected"
                  :disabled="!canSelect(item.row)"
                  size="sm"
                  :aria-label="t('table.selectRow')"
                  @update:model-value="toggleRow(item.row, $event)"
                />
              </td>
              <template v-for="(column, columnIndex) in leaves" :key="column.key">
                <td
                  v-if="
                    !spans || (spanOf(position, columnIndex)[0] && spanOf(position, columnIndex)[1])
                  "
                  :rowspan="
                    spans && spanOf(position, columnIndex)[0] > 1
                      ? spanOf(position, columnIndex)[0]
                      : undefined
                  "
                  :colspan="
                    spans && spanOf(position, columnIndex)[1] > 1
                      ? spanOf(position, columnIndex)[1]
                      : undefined
                  "
                  :class="[
                    cellMeta[columnIndex]!.class,
                    spans && ns.is('spanned', spanOf(position, columnIndex)[0] > 1),
                  ]"
                  :style="cellMeta[columnIndex]!.style"
                  @click="emit('cellClick', item.row, column, $event)"
                >
                  <span
                    v-if="column.key === treeColumnKey"
                    :class="ns.e('tree')"
                    :style="{ paddingInlineStart: `${(item.level - 1) * indent}px` }"
                  >
                    <button
                      v-if="item.parent"
                      type="button"
                      :class="[
                        ns.e('toggle'),
                        ns.is('open', rowExpanded),
                        ns.is('loading', rowLoading),
                      ]"
                      :aria-expanded="rowExpanded"
                      :aria-busy="rowLoading || undefined"
                      :aria-label="t('table.expandRow')"
                      @click.stop="toggleTree(item)"
                    >
                      <DouSpinner v-if="rowLoading" size="sm" />
                      <ChevronRightIcon v-else />
                    </button>
                    <span v-else :class="ns.e('toggle-space')" />
                    <span :class="ns.e('tree-content')">
                      <CellContent
                        v-if="hasCellSlot(column)"
                        :render="() => cellContent(item, column)"
                      />
                      <template v-else>{{ valueOf(item.row, column) ?? '' }}</template>
                    </span>
                  </span>
                  <CellContent
                    v-else-if="hasCellSlot(column)"
                    :render="() => cellContent(item, column)"
                  />
                  <template v-else>{{ valueOf(item.row, column) ?? '' }}</template>
                </td>
              </template>
            </tr>
            <tr
              v-if="hasExpand && canExpand(item.row) && rowExpanded"
              :id="`${id}-${item.key}`"
              :ref="measuredRows ? (el) => trackRow(el, item, position) : undefined"
              :class="ns.e('detail-row')"
            >
              <td :class="ns.e('detail')" :colspan="span">
                <CellContent :render="() => slots.expand?.({ row: item.row, index: item.index })" />
              </td>
            </tr>
          </TableRow>
          <tr v-if="virtual && spacerAfter > 0" :class="ns.e('spacer')" aria-hidden="true">
            <td :colspan="span" :style="{ height: `${spacerAfter}px` }" />
          </tr>
          <tr v-if="rows.length === 0" :class="ns.e('empty-row')">
            <td :class="ns.e('empty')" :colspan="span">
              <slot name="empty">
                <DouEmpty v-if="!loading" size="sm" :title="emptyText" />
              </slot>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="summaryValues" :class="ns.e('foot')">
          <tr
            :class="ns.e('summary')"
            :aria-rowindex="virtual ? rows.length + 1 + headerDepth : undefined"
          >
            <td
              v-if="hasDrag"
              :class="[ns.e('cell'), utilityFixed(0).class]"
              :style="utilityFixed(0).style"
            />
            <td
              v-if="hasExpand"
              :class="[ns.e('cell'), utilityFixed(expandAt).class]"
              :style="utilityFixed(expandAt).style"
            />
            <td
              v-if="hasSelection"
              :class="[ns.e('cell'), utilityFixed(selectionAt).class]"
              :style="utilityFixed(selectionAt).style"
            />
            <td
              v-for="column in leaves"
              :key="column.key"
              :class="[
                ns.e('cell'),
                alignClass(column),
                ns.is('ellipsis', !!column.ellipsis),
                fixedClass(column),
              ]"
              :style="fixedStyle(column)"
            >
              {{ summaryValues[column.key] ?? '' }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div v-if="loading" :class="ns.e('loading')">
      <DouSpinner />
    </div>
  </div>
</template>
