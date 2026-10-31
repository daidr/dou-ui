<script setup lang="ts" generic="Row = Record<string, unknown>">
import { useElementSize, useLocale } from 'dou-ui'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon } from '@dou-ui/icons'
import { computed, markRaw, nextTick, ref, shallowRef, toRaw, useId, watch } from 'vue'
import {
  computePivot,
  PivotSource,
  type PivotAggregator,
  type PivotResult,
  type PivotTree,
} from './engine'
import { BUILTIN_AGGREGATORS, FAST_AGGREGATES } from './engine/aggregate'
import type {
  PivotCollapsed,
  PivotConfig,
  PivotDimension,
  PivotField,
  PivotPath,
} from './engine/types'
import {
  collapsedNodes,
  columnLines,
  groupPaths,
  headerSpans,
  rowLines,
  samePath,
  spansIn,
  totalLines,
  type PivotAxis,
  type PivotHeaderSpan,
  type PivotLine,
} from './core/layout'
import { labelFormatter, valueFormatter } from './core/format'
import { format, usePivotMessages } from './locale'
import type { PivotCellEvent, PivotExpose, PivotProps } from './types'

defineOptions({ name: 'DouPivot' })

const props = withDefaults(defineProps<PivotProps<Row>>(), {
  height: 480,
  size: 'md',
  rowHeaderWidth: 200,
  columnWidth: 120,
})
const config = defineModel<PivotConfig>('config', { default: () => ({}) })
const collapsed = defineModel<PivotCollapsed>('collapsed', { default: () => ({}) })
const emit = defineEmits<{ 'cell-click': [cell: PivotCellEvent] }>()

const { locale } = useLocale()
const messages = usePivotMessages(() => props.messages)
const uid = useId()

const ROW_HEIGHT: Record<string, number> = { sm: 28, md: 32, lg: 40 }
const VALUE_HEADER_WIDTH = 120

// ---- the records, read once per array ----

let cache: {
  data: readonly Row[]
  fields: readonly PivotField<Row>[] | undefined
  locale: string
  source: PivotSource<Row>
} | null = null

const sameFields = (a?: readonly PivotField<Row>[], b?: readonly PivotField<Row>[]) => {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((f, i) => {
    const g = b[i]!
    return (
      f.name === g.name &&
      f.label === g.label &&
      f.type === g.type &&
      f.value === g.value &&
      f.format === g.format &&
      f.order === g.order
    )
  })
}

const source = computed(() => {
  const data = toRaw(props.data)
  const fields = props.fields && toRaw(props.fields)
  const name = locale.value.name
  if (cache && cache.data === data && cache.locale === name && sameFields(cache.fields, fields))
    return cache.source
  const next = markRaw(new PivotSource<Row>(data, { fields, locale: name }))
  cache = { data, fields, locale: name, source: next }
  return next
})

/** Stays the same object while the aggregators do, even when the array is written inline. */
let lastAggregators: Record<string, PivotAggregator> = {}
const aggregatorMap = computed(() => {
  const list = props.aggregators ?? []
  const last = Object.values(lastAggregators)
  if (list.length === last.length && list.every((a) => lastAggregators[a.name] === toRaw(a)))
    return lastAggregators
  const map: Record<string, PivotAggregator> = {}
  for (const aggregator of list) map[aggregator.name] = toRaw(aggregator)
  return (lastAggregators = map)
})

const keyReplacer = (_key: string, value: unknown) =>
  typeof value === 'function' ? undefined : value

const dimensionKey = (d: PivotDimension) =>
  typeof d === 'string' ? { field: d } : { field: d.field, sort: d.sort, subtotal: d.subtotal }

/**
 * The part of the config that changes what is summed up. Sorting, totals,
 * labels and formats leave it as it is, so they never sum up again.
 */
let engineCache: { key: string; config: PivotConfig } | null = null
const engineConfig = computed<PivotConfig>(() => {
  const c = config.value
  const custom = aggregatorMap.value
  const values = (c.values ?? []).filter((v) => {
    const name = typeof v === 'string' ? undefined : v.aggregate
    if (!name || FAST_AGGREGATES.has(name) || BUILTIN_AGGREGATORS[name] || custom[name]) return true
    if (import.meta.env?.DEV) console.warn(`[DouPivot] 没有名为 "${name}" 的汇总方式，已跳过这个值`)
    return false
  })
  const next: PivotConfig = {
    rows: (c.rows ?? []).map(dimensionKey),
    columns: (c.columns ?? []).map(dimensionKey),
    values: values.map((v) =>
      typeof v === 'string' ? { field: v } : { field: v.field, aggregate: v.aggregate },
    ),
    filters: c.filters,
  }
  const key = JSON.stringify(next, keyReplacer)
  if (engineCache?.key === key) return engineCache.config
  engineCache = { key, config: next }
  return next
})

const result = computed<PivotResult>(() =>
  markRaw(computePivot(source.value, engineConfig.value, { aggregators: aggregatorMap.value })),
)

// ---- what is shown ----

const valueCount = computed(() => result.value.values.length)
const valuesOnRows = computed(() => config.value.valuesOn === 'rows' && valueCount.value > 1)
const showRowTotal = computed(() => config.value.totals?.rows !== false)
const showColumnTotal = computed(() => config.value.totals?.columns !== false)

const rowCollapsed = computed(() => collapsedNodes(result.value.rows, collapsed.value.rows))
const columnCollapsed = computed(() =>
  collapsedNodes(result.value.columns, collapsed.value.columns),
)
const rowOrder = computed(() => result.value.rowOrder(config.value.sort))

const bodyLines = computed(() =>
  rowLines(result.value.rows, rowOrder.value, rowCollapsed.value, {
    values: valueCount.value,
    valuesHere: valuesOnRows.value,
    total: showRowTotal.value,
  }),
)
const footLines = computed(() =>
  totalLines(result.value.rows, {
    values: valueCount.value,
    valuesHere: valuesOnRows.value,
    total: showRowTotal.value,
  }),
)
const colLines = computed(() =>
  columnLines(result.value.columns, columnCollapsed.value, {
    values: valueCount.value,
    valuesHere: !valuesOnRows.value,
    total: showColumnTotal.value,
  }),
)
const valueRow = computed(() => !valuesOnRows.value || result.value.columns.levels.length === 0)
const spans = computed(() => headerSpans(result.value.columns, colLines.value, valueRow.value))

/** How each value is headed and written. */
const valueDisplay = computed(() => {
  const m = messages.value
  return result.value.values.map((value, i) => {
    const given = config.value.values?.[i]
    const spec = typeof given === 'object' ? given : undefined
    const label =
      spec?.label ??
      value.label ??
      (value.implicit || !value.field
        ? m.aggregates.count!
        : value.aggregate === 'sum'
          ? value.field.label
          : format(m.value, {
              field: value.field.label,
              aggregate:
                m.aggregates[value.aggregate] ?? value.aggregator?.label ?? value.aggregate,
            }))
    return {
      label,
      write: valueFormatter({ ...value, format: spec?.format ?? value.format }, locale.value.name),
    }
  })
})

const labelWriters = (tree: PivotTree) => {
  const m = messages.value
  const texts = { empty: m.empty, yes: m.yes, no: m.no }
  return tree.levels.map((level) => labelFormatter(level.field, locale.value.name, texts))
}
const rowWriters = computed(() => labelWriters(result.value.rows))
const colWriters = computed(() => labelWriters(result.value.columns))

const nodeText = (tree: PivotTree, writers: ((v: unknown) => string)[], node: number) =>
  node <= 0 ? messages.value.total : writers[tree.depth[node]! - 1]!(tree.label(node))

// ---- sizes and the window in view ----

const rowHeight = computed(() => ROW_HEIGHT[props.size] ?? 32)
const headRows = computed(() =>
  Math.max(1, result.value.columns.levels.length + (valueRow.value ? 1 : 0)),
)
const headHeight = computed(() => headRows.value * rowHeight.value)
/** On a narrow screen the row headers give up some width so the numbers still show. */
const rowHeadWidth = computed(() =>
  Math.min(props.rowHeaderWidth, Math.max(120, Math.floor(viewWidth.value * 0.4))),
)
const headWidth = computed(() => rowHeadWidth.value + (valuesOnRows.value ? VALUE_HEADER_WIDTH : 0))
/** Columns widen to fill a wide table, up to twice their width; past that the bands run on alone. */
const colWidth = computed(() => {
  const count = colLines.value.length
  const fill = count ? Math.floor((viewWidth.value - headWidth.value) / count) : 0
  return Math.max(props.columnWidth, Math.min(fill, props.columnWidth * 2))
})
const columnsWidth = computed(() => colLines.value.length * colWidth.value)
const totalWidth = computed(() => headWidth.value + columnsWidth.value)
const bodyHeight = computed(() => bodyLines.value.length * rowHeight.value)
const footHeight = computed(() => footLines.value.length * rowHeight.value)

const root = ref<HTMLElement>()
const viewport = ref<HTMLElement>()
const { width: viewWidth, height: viewHeight } = useElementSize(viewport, {
  initial: { width: 960, height: 480 },
})
const scroll = shallowRef({ top: 0, left: 0 })
/** The height of the horizontal scrollbar, when there is one that takes room. */
const gutter = ref(0)
watch(
  [viewWidth, viewHeight, () => totalWidth.value],
  () =>
    nextTick(() => {
      const el = viewport.value
      if (el) gutter.value = el.offsetHeight - el.clientHeight
    }),
  { flush: 'post' },
)

function onScroll() {
  const el = viewport.value
  if (!el) return
  if (el.scrollTop !== scroll.value.top || el.scrollLeft !== scroll.value.left)
    scroll.value = { top: el.scrollTop, left: el.scrollLeft }
}

const OVERSCAN_ROWS = 6
const OVERSCAN_COLS = 2

const rowWindow = computed(() => {
  const h = rowHeight.value
  const space = Math.max(h, viewHeight.value - headHeight.value - footHeight.value)
  const from = Math.max(0, Math.floor(scroll.value.top / h) - OVERSCAN_ROWS)
  const to = Math.min(
    bodyLines.value.length,
    Math.ceil((scroll.value.top + space) / h) + OVERSCAN_ROWS,
  )
  return { from, to }
})

const colWindow = computed(() => {
  const w = colWidth.value
  const space = Math.max(w, viewWidth.value - headWidth.value)
  const from = Math.max(0, Math.floor(scroll.value.left / w) - OVERSCAN_COLS)
  const to = Math.min(
    colLines.value.length,
    Math.ceil((scroll.value.left + space) / w) + OVERSCAN_COLS,
  )
  // a stable object while the window stays put, so rows can skip re-rendering
  const last = lastColWindow
  if (last && last.from === from && last.to === to) return last
  return (lastColWindow = { from, to })
})
let lastColWindow: { from: number; to: number } | null = null

const visibleRows = computed(() => {
  const { from, to } = rowWindow.value
  const out: { line: PivotLine; index: number }[] = []
  for (let i = from; i < to; i++) out.push({ line: bodyLines.value[i]!, index: i })
  return out
})
const visibleFoot = computed(() =>
  footLines.value.map((line, i) => ({ line, index: bodyLines.value.length + i })),
)
const visibleCols = computed(() => {
  const { from, to } = colWindow.value
  return colLines.value.slice(from, to).map((line, i) => ({ line, index: from + i }))
})
const visibleSpans = computed(() => {
  const { from, to } = colWindow.value
  return spans.value.map((list) => spansIn(list, from, to))
})

// ---- rows ----

const rowTree = computed(() => result.value.rows)

/** Whether a group's own row is blank because its field has no subtotals and it is open. */
const rowBlank = (line: PivotLine) => {
  if (line.kind !== 'group') return false
  const tree = rowTree.value
  if (!tree.isGroup(line.node) || rowCollapsed.value.has(line.node)) return false
  return !tree.levels[tree.depth[line.node]! - 1]!.subtotal
}

const isFirstOfNode = (line: PivotLine) => line.value <= 0

interface RowHead {
  text: string
  depth: number
  group: boolean
  open: boolean
  valueText: string
  firstOfNode: boolean
}

function rowHead(line: PivotLine): RowHead {
  const tree = rowTree.value
  const group = line.kind === 'group' && tree.isGroup(line.node)
  return {
    text:
      line.kind === 'total' ? messages.value.total : nodeText(tree, rowWriters.value, line.node),
    depth: line.kind === 'total' ? 0 : tree.depth[line.node]! - 1,
    group,
    open: group && !rowCollapsed.value.has(line.node),
    valueText: line.value >= 0 ? valueDisplay.value[line.value]!.label : '',
    firstOfNode: isFirstOfNode(line),
  }
}

interface Cell {
  key: number
  text: string
  cls: string
  col: number
}

function rowCells(line: PivotLine): Cell[] {
  const res = result.value
  const blank = rowBlank(line)
  const display = valueDisplay.value
  return visibleCols.value.map(({ line: col, index }) => {
    const v = line.value >= 0 ? line.value : Math.max(0, col.value)
    const n = blank ? Number.NaN : res.get(line.node, col.node, v)
    let cls = 'dou-pivot__cell'
    if (col.kind !== 'group') cls += ' is-total'
    if (col.kind === 'group' && col.node > 0 && res.columns.isGroup(col.node)) cls += ' is-closed'
    return { key: index, col: index, text: display[v]!.write(n), cls }
  })
}

// ---- header ----

interface HeadCell {
  key: string
  span: PivotHeaderSpan
  text: string
  style: string
  toggle: boolean
  open: boolean
  sortable: boolean
  sorted: 'asc' | 'desc' | null
  cls: string
}

const columnPath = (line: { kind: string; node: number }) =>
  line.kind === 'total' ? [] : result.value.columns.path(line.node)

const headCells = computed<HeadCell[]>(() => {
  const tree = result.value.columns
  const w = colWidth.value
  const h = rowHeight.value
  const sort = config.value.sort
  const out: HeadCell[] = []
  const rows = headRows.value
  visibleSpans.value.forEach((list) => {
    for (const span of list) {
      const reachesBottom = span.level + span.rows === rows
      const single = span.to - span.from === 1
      const line = colLines.value[span.from]!
      const sortable = span.kind === 'value' || (reachesBottom && single && !valueRow.value)
      const value = span.kind === 'value' ? Math.max(0, span.value) : Math.max(0, line.value)
      const sorted =
        sortable && sort && sort.value === value && samePath(sort.column ?? [], columnPath(line))
          ? sort.order
          : null
      const canToggle = span.kind === 'group' && tree.isGroup(span.node)
      let text: string
      if (span.kind === 'value')
        text = span.value >= 0 ? valueDisplay.value[span.value]!.label : messages.value.total
      else if (span.kind === 'total') text = messages.value.total
      else if (span.kind === 'subtotal')
        text = format(messages.value.subtotal, {
          label: nodeText(tree, colWriters.value, span.node),
        })
      else text = nodeText(tree, colWriters.value, span.node)
      let cls = `dou-pivot__col-head is-${span.kind}`
      // over the numbers, names sit right like them; a group with a toggle reads from the left
      if (span.kind !== 'group' || (!canToggle && single)) cls += ' is-end'
      if (span.kind === 'value' && line.kind !== 'group') cls += ' is-total'
      if (sorted) cls += ' is-sorted'
      out.push({
        key: `${span.level}:${span.from}:${span.kind}`,
        span,
        text,
        style: `left:${span.from * w}px;top:${span.level * h}px;width:${(span.to - span.from) * w}px;height:${span.rows * h}px`,
        toggle: canToggle,
        open: canToggle && !columnCollapsed.value.has(span.node),
        sortable,
        sorted,
        cls,
      })
    }
  })
  return out
})

const rowFields = computed(() =>
  result.value.rows.levels.map((level, i) => ({
    index: i,
    label: level.field.label,
    sort: level.sort,
  })),
)
const columnFields = computed(() => result.value.columns.levels.map((level) => level.field.label))

// ---- changing the config and the collapsed groups ----

function sortByColumn(span: PivotHeaderSpan) {
  const line = colLines.value[span.from]!
  const value = span.kind === 'value' ? Math.max(0, span.value) : Math.max(0, line.value)
  const column = columnPath(line)
  const current = config.value.sort
  const same = current && current.value === value && samePath(current.column ?? [], column)
  // descending first (largest on top), then ascending, then back to the labels
  const order = !same ? 'desc' : current!.order === 'desc' ? 'asc' : null
  config.value = { ...config.value, sort: order ? { value, column, order } : null }
}

function sortByField(index: number) {
  const rows = (config.value.rows ?? []).map((d, i) => {
    const spec = typeof d === 'string' ? { field: d } : { ...d }
    if (i !== index) return d
    const wasValueSorted = !!config.value.sort
    spec.sort = wasValueSorted ? (spec.sort ?? 'asc') : spec.sort === 'desc' ? 'asc' : 'desc'
    return spec
  })
  config.value = { ...config.value, rows, sort: null }
}

function setCollapsed(axis: PivotAxis, paths: PivotPath[]) {
  collapsed.value = { ...collapsed.value, [axis]: paths }
}

function toggle(axis: PivotAxis, path: PivotPath, open?: boolean) {
  const list = collapsed.value[axis] ?? []
  const at = list.findIndex((p) => samePath(p, path))
  const isOpen = at < 0
  const next = open ?? !isOpen
  if (next === isOpen) return
  setCollapsed(axis, next ? list.filter((_, i) => i !== at) : [...list, path])
}

function toggleNode(axis: PivotAxis, node: number, all = false) {
  const tree = axis === 'rows' ? result.value.rows : result.value.columns
  const nodes = axis === 'rows' ? rowCollapsed.value : columnCollapsed.value
  const open = nodes.has(node)
  if (!all) return toggle(axis, tree.path(node), open)
  // Alt: every group at the same depth goes the same way
  const depth = tree.depth[node]!
  const same: PivotPath[] = []
  for (let at = 1; at < tree.size; at++)
    if (tree.depth[at] === depth && tree.isGroup(at)) same.push(tree.path(at))
  const rest = (collapsed.value[axis] ?? []).filter((p) => !same.some((q) => samePath(p, q)))
  setCollapsed(axis, open ? rest : [...rest, ...same])
}

function expandAll(axis?: PivotAxis) {
  const next = { ...collapsed.value }
  for (const a of axis ? [axis] : (['rows', 'columns'] as const)) next[a] = []
  collapsed.value = next
}

function collapseAll(axis?: PivotAxis, depth = 1) {
  const next = { ...collapsed.value }
  for (const a of axis ? [axis] : (['rows', 'columns'] as const))
    next[a] = groupPaths(a === 'rows' ? result.value.rows : result.value.columns, depth)
  collapsed.value = next
}

// ---- pointer and keys ----

const active = shallowRef<{ row: number; col: number } | null>(null)
const focused = ref(false)
const allLines = computed(() => [...bodyLines.value, ...footLines.value])

const cellId = (row: number, col: number) => `${uid}-${row}-${col}`
const activeId = computed(() => {
  const a = active.value
  if (!a || !focused.value) return undefined
  return cellId(a.row, a.col)
})

function cellEvent(row: PivotLine, col: PivotLine): PivotCellEvent {
  const res = result.value
  const value = row.value >= 0 ? row.value : Math.max(0, col.value)
  return {
    row: row.kind === 'total' ? [] : res.rows.path(row.node),
    column: col.kind === 'total' ? [] : res.columns.path(col.node),
    value,
    number: rowBlank(row) ? Number.NaN : res.get(row.node, col.node, value),
    records: () => res.records(row.node, col.node),
  }
}

function onClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const sortField = target.closest<HTMLElement>('[data-sort-field]')
  if (sortField) return sortByField(Number(sortField.dataset.sortField))
  const head = target.closest<HTMLElement>('[data-head]')
  if (head) {
    const cell = headCells.value.find((c) => c.key === head.dataset.head)
    if (!cell) return
    if (cell.toggle && (target.closest('[data-toggle]') || !cell.sortable))
      return toggleNode('columns', cell.span.node, event.altKey)
    if (cell.sortable) sortByColumn(cell.span)
    return
  }
  const el = target.closest<HTMLElement>('[data-row]')
  if (!el) return
  const row = Number(el.dataset.row)
  const col = Number(el.dataset.col)
  active.value = { row, col }
  const line = allLines.value[row]
  if (!line) return
  if (col < 0) {
    if (line.kind === 'group' && rowTree.value.isGroup(line.node))
      toggleNode('rows', line.node, event.altKey)
    return
  }
  const column = colLines.value[col]
  if (column) emit('cell-click', cellEvent(line, column))
}

function ensureVisible(row: number, col: number) {
  const el = viewport.value
  if (!el) return
  const h = rowHeight.value
  if (row < bodyLines.value.length) {
    const space = viewHeight.value - headHeight.value - footHeight.value
    if (row * h < el.scrollTop) el.scrollTop = row * h
    else if ((row + 1) * h > el.scrollTop + space) el.scrollTop = (row + 1) * h - space
  }
  if (col >= 0) {
    const w = colWidth.value
    const space = viewWidth.value - headWidth.value
    if (col * w < el.scrollLeft) el.scrollLeft = col * w
    else if ((col + 1) * w > el.scrollLeft + space) el.scrollLeft = (col + 1) * w - space
  }
  onScroll()
}

function moveTo(row: number, col: number) {
  const rows = allLines.value.length
  const cols = colLines.value.length
  if (rows === 0) return
  const next = {
    row: Math.max(0, Math.min(rows - 1, row)),
    col: Math.max(-1, Math.min(cols - 1, col)),
  }
  active.value = next
  ensureVisible(next.row, next.col)
}

/** The index of the first line of `node`'s parent above `row`. */
function parentRow(row: number) {
  const lines = allLines.value
  const tree = rowTree.value
  const parent = tree.parent[lines[row]!.node]!
  if (parent <= 0) return row
  for (let i = row - 1; i >= 0; i--) {
    if (lines[i]!.node === parent) {
      let first = i
      while (first > 0 && lines[first - 1]!.node === parent) first--
      return first
    }
  }
  return row
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  const a = active.value ?? { row: 0, col: -1 }
  const line = allLines.value[a.row]
  const tree = rowTree.value
  const isGroup = !!line && line.kind === 'group' && tree.isGroup(line.node)
  const open = isGroup && !rowCollapsed.value.has(line!.node)
  const page = Math.max(1, Math.floor((viewHeight.value - headHeight.value) / rowHeight.value) - 1)
  const mod = event.ctrlKey || event.metaKey
  switch (event.key) {
    case 'ArrowDown':
      moveTo(a.row + 1, a.col)
      break
    case 'ArrowUp':
      moveTo(a.row - 1, a.col)
      break
    case 'ArrowRight':
      if (a.col < 0 && isGroup && !open) toggleNode('rows', line!.node)
      else moveTo(a.row, a.col + 1)
      break
    case 'ArrowLeft':
      if (a.col < 0 && open) toggleNode('rows', line!.node)
      else if (a.col < 0 && line) moveTo(parentRow(a.row), -1)
      else moveTo(a.row, a.col - 1)
      break
    case 'PageDown':
      moveTo(a.row + page, a.col)
      break
    case 'PageUp':
      moveTo(a.row - page, a.col)
      break
    case 'Home':
      moveTo(mod ? 0 : a.row, -1)
      break
    case 'End':
      moveTo(mod ? allLines.value.length - 1 : a.row, colLines.value.length - 1)
      break
    case 'Enter':
    case ' ':
      if (!line) return
      if (a.col < 0) {
        if (isGroup) toggleNode('rows', line.node, event.altKey)
      } else if (event.key === 'Enter') {
        const column = colLines.value[a.col]
        if (column) emit('cell-click', cellEvent(line, column))
      }
      break
    default:
      return
  }
  event.preventDefault()
}

function onFocus() {
  focused.value = true
  if (!active.value && allLines.value.length) active.value = { row: 0, col: -1 }
}

// keep the active cell on the table when lines come and go
watch(allLines, (lines) => {
  const a = active.value
  if (a && a.row >= lines.length)
    active.value = lines.length ? { row: lines.length - 1, col: a.col } : null
})
watch(colLines, (lines) => {
  const a = active.value
  if (a && a.col >= lines.length) active.value = { row: a.row, col: lines.length - 1 }
})

// back to the top left when the layout changes
watch(engineConfig, () => {
  nextTick(() => {
    const el = viewport.value
    if (!el) return
    el.scrollTop = 0
    el.scrollLeft = 0
    onScroll()
  })
})

const ariaLabel = computed(() => props.ariaLabel ?? messages.value.pivot)
const rootStyle = computed(() => {
  const height = typeof props.height === 'number' ? `${props.height}px` : props.height
  // a short table ends with its last row instead of leaving blank space under it
  const content = headHeight.value + bodyHeight.value + footHeight.value + gutter.value + 2
  return `height:min(${height}, ${content}px);--dou-pivot-row-height:${rowHeight.value}px;--dou-pivot-head-width:${headWidth.value}px`
})

defineExpose<PivotExpose>({
  get result() {
    return result.value
  },
  expandAll,
  collapseAll,
  toggle,
})
</script>

<template>
  <div
    ref="root"
    class="dou-pivot"
    :class="[
      `dou-pivot--${size}`,
      {
        'is-focused': focused,
        'is-scrolled-x': scroll.left > 0,
        'is-scrolled-y': scroll.top > 0,
        'has-values-column': valuesOnRows,
      },
    ]"
    :style="rootStyle"
  >
    <div
      ref="viewport"
      class="dou-pivot__viewport"
      role="treegrid"
      tabindex="0"
      :aria-label="ariaLabel"
      :aria-rowcount="headRows + allLines.length"
      :aria-colcount="colLines.length + (valuesOnRows ? 2 : 1)"
      :aria-activedescendant="activeId"
      @scroll="onScroll"
      @click="onClick"
      @keydown="onKeydown"
      @focus="onFocus"
      @blur="focused = false"
    >
      <div class="dou-pivot__sheet" :style="`width:${totalWidth}px`">
        <div class="dou-pivot__head" role="rowgroup" :style="`height:${headHeight}px`">
          <div class="dou-pivot__corner" :style="`width:${headWidth}px;height:${headHeight}px`">
            <div
              v-for="(label, level) in columnFields"
              :key="`c${level}`"
              class="dou-pivot__corner-line is-column"
              :style="`top:${level * rowHeight}px`"
            >
              <span class="dou-pivot__corner-label">{{ label }}</span>
            </div>
            <div
              class="dou-pivot__corner-line is-rows"
              :style="`top:${(headRows - 1) * rowHeight}px`"
            >
              <template v-for="field in rowFields" :key="field.index">
                <span v-if="field.index > 0" class="dou-pivot__corner-sep" aria-hidden="true"
                  >/</span
                >
                <button
                  type="button"
                  class="dou-pivot__field"
                  :class="{ 'is-sorted': !config.sort && field.sort === 'desc' }"
                  tabindex="-1"
                  :data-sort-field="field.index"
                  :aria-label="format(messages.sortField, { field: field.label })"
                >
                  {{ field.label }}
                  <ArrowDownIcon v-if="!config.sort && field.sort === 'desc'" aria-hidden="true" />
                </button>
              </template>
              <span v-if="valuesOnRows" class="dou-pivot__corner-values">{{
                messages.values
              }}</span>
            </div>
          </div>
          <div
            class="dou-pivot__col-heads"
            :style="`width:${columnsWidth}px;height:${headHeight}px`"
          >
            <div
              v-for="cell in headCells"
              :key="cell.key"
              :class="cell.cls"
              role="columnheader"
              :aria-sort="
                cell.sorted ? (cell.sorted === 'asc' ? 'ascending' : 'descending') : undefined
              "
              :aria-expanded="cell.toggle ? cell.open : undefined"
              :data-head="cell.key"
              :title="cell.sortable ? messages.sortValue : undefined"
              :style="cell.style"
            >
              <span class="dou-pivot__col-label">
                <span
                  v-if="cell.toggle"
                  class="dou-pivot__toggle"
                  :class="{ 'is-open': cell.open }"
                  data-toggle
                  :aria-label="cell.open ? messages.collapse : messages.expand"
                >
                  <ChevronRightIcon aria-hidden="true" />
                </span>
                <span class="dou-pivot__text">{{ cell.text }}</span>
                <ArrowUpIcon
                  v-if="cell.sorted === 'asc'"
                  class="dou-pivot__sort"
                  aria-hidden="true"
                />
                <ArrowDownIcon
                  v-else-if="cell.sorted === 'desc'"
                  class="dou-pivot__sort"
                  aria-hidden="true"
                />
              </span>
            </div>
          </div>
        </div>

        <div class="dou-pivot__body" role="rowgroup" :style="`height:${bodyHeight}px`">
          <div
            v-for="{ line, index } in visibleRows"
            :key="index"
            v-memo="[
              line,
              colWindow,
              colLines,
              colWidth,
              rowHeadWidth,
              valueDisplay,
              rowWriters,
              active?.row === index ? active.col : -9,
            ]"
            class="dou-pivot__row"
            :class="{
              'is-group': line.kind === 'group' && rowTree.isGroup(line.node),
              'is-node-start': line.value <= 0,
            }"
            role="row"
            :aria-rowindex="headRows + index + 1"
            :aria-level="rowTree.depth[line.node]"
            :aria-expanded="
              line.kind === 'group' && rowTree.isGroup(line.node)
                ? !rowCollapsed.has(line.node)
                : undefined
            "
            :style="`top:${index * rowHeight}px;width:${totalWidth}px`"
          >
            <template v-for="head in [rowHead(line)]" :key="0">
              <div
                :id="cellId(index, -1)"
                class="dou-pivot__row-head"
                :class="{
                  'is-active': active?.row === index && active.col === -1,
                  'is-clickable': head.group,
                }"
                role="rowheader"
                :data-row="index"
                data-col="-1"
                :style="`width:${rowHeadWidth}px;padding-left:${12 + head.depth * 16}px`"
              >
                <template v-if="head.firstOfNode">
                  <span
                    v-if="head.group"
                    class="dou-pivot__toggle"
                    :class="{ 'is-open': head.open }"
                    aria-hidden="true"
                  >
                    <ChevronRightIcon />
                  </span>
                  <span v-else-if="rowTree.levels.length > 1" class="dou-pivot__toggle-space" />
                  <span class="dou-pivot__text">{{ head.text }}</span>
                </template>
              </div>
              <div
                v-if="valuesOnRows"
                class="dou-pivot__value-head"
                role="rowheader"
                :style="`width:${VALUE_HEADER_WIDTH}px;left:${rowHeadWidth}px`"
              >
                <span class="dou-pivot__text">{{ head.valueText }}</span>
              </div>
            </template>
            <div class="dou-pivot__spacer" :style="`width:${colWindow.from * colWidth}px`" />
            <div
              v-for="cell in rowCells(line)"
              :id="cellId(index, cell.col)"
              :key="cell.key"
              :class="[cell.cls, { 'is-active': active?.row === index && active.col === cell.col }]"
              role="gridcell"
              :aria-colindex="cell.col + (valuesOnRows ? 3 : 2)"
              :data-row="index"
              :data-col="cell.col"
              :style="`width:${colWidth}px`"
            >
              <span class="dou-pivot__text">{{ cell.text }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="footLines.length"
          class="dou-pivot__foot"
          role="rowgroup"
          :style="`height:${footHeight}px`"
        >
          <div
            v-for="({ line, index }, i) in visibleFoot"
            :key="index"
            class="dou-pivot__row is-total"
            role="row"
            :aria-rowindex="headRows + index + 1"
            :style="`top:${i * rowHeight}px;width:${totalWidth}px`"
          >
            <div
              :id="cellId(index, -1)"
              class="dou-pivot__row-head"
              :class="{ 'is-active': active?.row === index && active.col === -1 }"
              role="rowheader"
              :data-row="index"
              data-col="-1"
              :style="`width:${rowHeadWidth}px`"
            >
              <span v-if="line.value <= 0" class="dou-pivot__text">{{ messages.total }}</span>
            </div>
            <div
              v-if="valuesOnRows"
              class="dou-pivot__value-head"
              role="rowheader"
              :style="`width:${VALUE_HEADER_WIDTH}px;left:${rowHeadWidth}px`"
            >
              <span class="dou-pivot__text">{{ valueDisplay[line.value]?.label }}</span>
            </div>
            <div class="dou-pivot__spacer" :style="`width:${colWindow.from * colWidth}px`" />
            <div
              v-for="cell in rowCells(line)"
              :id="cellId(index, cell.col)"
              :key="cell.key"
              :class="[cell.cls, { 'is-active': active?.row === index && active.col === cell.col }]"
              role="gridcell"
              :aria-colindex="cell.col + (valuesOnRows ? 3 : 2)"
              :data-row="index"
              :data-col="cell.col"
              :style="`width:${colWidth}px`"
            >
              <span class="dou-pivot__text">{{ cell.text }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="result.matched === 0" class="dou-pivot__empty" role="status">
        {{ messages.noData }}
      </div>
    </div>
  </div>
</template>
