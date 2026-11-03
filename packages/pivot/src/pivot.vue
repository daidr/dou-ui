<script setup lang="ts" generic="Row = Record<string, unknown>">
import type { HTMLAttributes } from 'vue'
import type { ForwardedAttributes } from 'dou-ui'
import { useElementSize, useLocale } from 'dou-ui'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon } from '@dou-ui/icons'
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  toRaw,
  useId,
  watch,
} from 'vue'
import {
  computePivot,
  PivotSource,
  type PivotAggregator,
  type PivotResult,
  type PivotTree,
} from './engine'
import { BUILTIN_AGGREGATORS, FAST_AGGREGATES } from './engine/aggregate'
import { markOf, PERCENT_SHOWS, showOf } from './engine/compute'
import type { PivotEngine } from './engine/engine'
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
import { labelFormatter, valueFormatter, valueNumberOptions } from './core/format'
import { valueLabel } from './core/labels'
import { usePivotSource } from './core/source'
import {
  gridMerges,
  gridToCSV,
  gridToHTML,
  gridToSheetCells,
  gridToTSV,
  sheetFormat,
  SHEET_STYLES,
  type PivotCSVOptions,
  type PivotGrid,
  type PivotGridCell,
} from './core/table'
import { format, usePivotMessages } from './locale'
import type {
  PivotCellEvent,
  PivotChartRows,
  PivotChartRowsOptions,
  PivotCopyOptions,
  PivotEmits,
  PivotExpose,
  PivotPrintOptions,
  PivotProps,
  PivotSheetWorkbook,
} from './types'

defineOptions({ name: 'DouPivot' })

const props = withDefaults(
  defineProps<
    PivotProps<Row> &
      /* @vue-ignore */ ForwardedAttributes<
        HTMLAttributes,
        PivotProps<Row>,
        keyof PivotEmits & string
      >
  >(),
  {
    layout: 'compact',
    resizable: true,
    worker: 'auto',
    maxHeight: 480,
    size: 'md',
    rowHeaderWidth: 200,
    columnWidth: 120,
  },
)
const config = defineModel<PivotConfig>('config', { default: () => ({}) })
const collapsed = defineModel<PivotCollapsed>('collapsed', { default: () => ({}) })
const emit = defineEmits<{ cellClick: [cell: PivotCellEvent<Row>] }>()

const { locale } = useLocale()
const messages = usePivotMessages(() => props.messages)
const uid = useId()

const ROW_HEIGHT: Record<string, number> = { sm: 28, md: 32, lg: 40 }
const VALUE_HEADER_WIDTH = 120

// ---- the records, read once per array ----

const source = usePivotSource(
  () => props.data,
  () => props.fields,
)

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
  typeof d === 'string'
    ? { field: d }
    : { field: d.field, sort: d.sort, subtotal: d.subtotal, by: d.by }

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
    if (import.meta.env?.DEV)
      console.warn(`[@dou-ui/pivot] 没有名为 "${name}" 的汇总方式，已跳过这个值`)
    return false
  })
  const next: PivotConfig = {
    rows: (c.rows ?? []).map(dimensionKey),
    columns: (c.columns ?? []).map(dimensionKey),
    // how values are shown, marked, headed and written changes nothing to sum up
    values: values.map((v) =>
      typeof v === 'string'
        ? { field: v }
        : v.formula !== undefined
          ? { formula: v.formula }
          : { field: v.field, aggregate: v.aggregate },
    ),
    filters: c.filters,
  }
  const key = JSON.stringify(next, keyReplacer)
  if (engineCache?.key === key) return engineCache.config
  engineCache = { key, config: next }
  return next
})

// ---- summing up: here, or in a worker ----

/** Records from which `'auto'` sums up in a worker. */
const WORKER_FROM = 100_000
/** How long a worker may take before the table says it is busy, in ms. */
const BUSY_AFTER = 120

/** Set when the table's own worker cannot start (under a strict CSP, say); it then sums up here. */
const ownFailed = ref(false)
const away = computed(
  () =>
    !!props.engine ||
    (!ownFailed.value &&
      (props.worker === true ||
        (props.worker === 'auto' &&
          source.value.length > WORKER_FROM &&
          typeof Worker !== 'undefined'))),
)

/** The last result summed up here, shown while a worker sums up the first time. */
let lastHere: PivotResult | null = null
const here = computed(() => {
  if (away.value) return null
  const next = computePivot(source.value, engineConfig.value, { aggregators: aggregatorMap.value })
  return (lastHere = markRaw(next))
})

/** What a worker last sent, and whether a newer one is on its way. */
const fromAway = shallowRef<PivotResult | null>(null)
const busy = ref(false)
/** Groups with no records yet: the shape of the table while the first result is on its way. */
const shapeOnly = computed(() =>
  markRaw(computePivot(new PivotSource([], { fields: [...source.value.fields.values()] }), {})),
)
const result = computed<PivotResult>(() => here.value ?? fromAway.value ?? shapeOnly.value)

let ownEngine: PivotEngine | null = null
async function startOwnEngine() {
  const [{ createPivotWorker }, { default: PivotWorker }] = await Promise.all([
    import('./worker/client'),
    import('./worker/default?worker&inline'),
  ])
  return createPivotWorker(() => new PivotWorker())
}
let ownEngineReady: Promise<PivotEngine> | null = null
const engineFor = () =>
  props.engine
    ? Promise.resolve(props.engine)
    : (ownEngineReady ??= startOwnEngine().then((engine) => (ownEngine = engine)))

let job = 0
let stop: AbortController | null = null
watch(
  [away, source, engineConfig, () => props.engine],
  async ([isAway, src, cfg]) => {
    stop?.abort()
    stop = null
    const id = ++job
    if (!isAway) {
      busy.value = false
      fromAway.value = null
      return
    }
    // keep what is on screen until the worker's first result comes
    if (!fromAway.value && lastHere) fromAway.value = lastHere
    lastHere = null
    const controller = (stop = new AbortController())
    const slow = setTimeout(() => id === job && (busy.value = true), BUSY_AFTER)
    try {
      const engine = await engineFor()
      const next = await engine.compute(src, cfg, {
        aggregators: aggregatorMap.value,
        signal: controller.signal,
      })
      if (id !== job) return
      fromAway.value = markRaw(next)
    } catch (error) {
      if (id !== job || (error as Error).name === 'AbortError') return
      if (props.engine) console.error('[@dou-ui/pivot] engine 汇总失败', error)
      else {
        // the own worker failed: sum up on the page from now on
        console.warn('[@dou-ui/pivot] worker 不可用，改为在页面中汇总', error)
        ownEngine?.dispose?.()
        ownEngine = null
        ownEngineReady = null
        ownFailed.value = true
      }
    } finally {
      clearTimeout(slow)
      if (id === job) busy.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stop?.abort()
  job++
  ownEngine?.dispose?.()
})

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
/** Each row field in a column of its own, open groups' totals on a line after their children. */
const tabular = computed(() => props.layout === 'tabular' && result.value.rows.levels.length > 0)

const bodyLines = computed(() =>
  rowLines(result.value.rows, rowOrder.value, rowCollapsed.value, {
    values: valueCount.value,
    valuesHere: valuesOnRows.value,
    total: showRowTotal.value,
    totalsAfter: tabular.value,
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
/**
 * The row naming each column's value: left out when the values run along the
 * rows, and when one value sits under column groups (each would repeat it).
 */
const valueRow = computed(
  () => result.value.columns.levels.length === 0 || (!valuesOnRows.value && valueCount.value > 1),
)
const spans = computed(() => headerSpans(result.value.columns, colLines.value, valueRow.value))

/** How each value is headed, shown, marked and written: the config's, on what was summed up. */
const valueDisplay = computed(() => {
  const m = messages.value
  return result.value.values.map((value, i) => {
    const given = config.value.values?.[i]
    const spec = typeof given === 'object' ? given : undefined
    const show = showOf(spec?.show)
    // a share or a rank is not in the field's units
    const own = show && (PERCENT_SHOWS.has(show.as) || show.as === 'rank')
    const shownValue = {
      ...value,
      show,
      format: spec?.format ?? (own ? undefined : value.format),
    }
    const options = valueNumberOptions(shownValue)
    return {
      label: valueLabel(shownValue, spec?.label, m),
      write: valueFormatter(shownValue, locale.value.name),
      /** The same format for a sheet, when there is one. */
      sheetFormat: options ? sheetFormat(options, locale.value.name) : undefined,
      show: show ?? null,
      mark: markOf(spec?.mark),
    }
  })
})

const labelWriters = (tree: PivotTree) => {
  const m = messages.value
  const texts = {
    empty: m.empty,
    yes: m.yes,
    no: m.no,
    year: m.yearLabel,
    quarter: m.quarterLabel,
    week: m.weekLabel,
    range: m.rangeLabel,
  }
  return tree.levels.map((level) => labelFormatter(level.field, locale.value.name, texts, level.by))
}
const rowWriters = computed(() => labelWriters(result.value.rows))
const colWriters = computed(() => labelWriters(result.value.columns))

const nodeText = (tree: PivotTree, writers: ((v: unknown) => string)[], node: number) =>
  node <= 0 ? messages.value.total : writers[tree.depth[node]! - 1]!(tree.label(node))

// ---- sizes and the window in view ----

const rowHeight = computed(() => ROW_HEIGHT[props.size] ?? 32)
/** A row per column field, and one more for the row fields (and the values, when shown). */
const headRows = computed(() => result.value.columns.levels.length + 1)
const headHeight = computed(() => headRows.value * rowHeight.value)
/** Set by dragging the edge of the corner; `0` for the width worked out from the props. */
const rowHeadDragged = ref(0)
const rowLevelCount = computed(() => (tabular.value ? result.value.rows.levels.length : 1))
/**
 * The row headers' width. A tabular layout gives each row field a column of
 * 60% of `rowHeaderWidth`. On a narrow screen the row headers give up some
 * width so the numbers still show.
 */
const rowHeadWidth = computed(() => {
  if (rowHeadDragged.value) return rowHeadDragged.value
  const want = tabular.value
    ? rowLevelCount.value * Math.round(props.rowHeaderWidth * 0.6)
    : props.rowHeaderWidth
  return Math.min(want, Math.max(120, Math.floor(viewWidth.value * (tabular.value ? 0.5 : 0.4))))
})
/** The width of each row field's column in the tabular layout. */
const levelWidth = computed(() => Math.floor(rowHeadWidth.value / rowLevelCount.value))
const headWidth = computed(() => rowHeadWidth.value + (valuesOnRows.value ? VALUE_HEADER_WIDTH : 0))
/** Columns widen to fill a wide table, up to twice their width; past that the bands run on alone. */
const colWidth = computed(() => {
  const count = colLines.value.length
  const fill = count ? Math.floor((viewWidth.value - headWidth.value) / count) : 0
  return Math.max(props.columnWidth, Math.min(fill, props.columnWidth * 2))
})
/** Widths set by dragging a column's edge, by the column's groups, kind and value. */
const dragged = shallowRef(new Map<string, number>())
const colKey = (line: PivotLine) =>
  `${line.kind}|${line.value}|${line.kind === 'total' ? '' : JSON.stringify(result.value.columns.path(line.node))}`
/** Where each column starts; the last entry is where the last one ends. */
const colStarts = computed(() => {
  const lines = colLines.value
  const starts = new Float64Array(lines.length + 1)
  const base = colWidth.value
  const map = dragged.value
  for (let i = 0; i < lines.length; i++)
    starts[i + 1] = starts[i]! + (map.size ? (map.get(colKey(lines[i]!)) ?? base) : base)
  return starts
})
/** The column at `x` px from the left of the columns. */
function columnAt(x: number) {
  const starts = colStarts.value
  let low = 0
  let high = starts.length - 2
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid]! <= x) low = mid
    else high = mid - 1
  }
  return Math.max(0, low)
}
const columnsWidth = computed(() => colStarts.value[colLines.value.length]!)
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
  const space = Math.max(colWidth.value, viewWidth.value - headWidth.value)
  const count = colLines.value.length
  const from = Math.max(0, columnAt(scroll.value.left) - OVERSCAN_COLS)
  const to = count ? Math.min(count, columnAt(scroll.value.left + space) + 1 + OVERSCAN_COLS) : 0
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

/** A group whose label shows on a line: in the tabular layout, one per row field. */
interface RowHeadPart {
  text: string
  /** The group a click on the arrow opens or closes, or -1. */
  toggle: number
  open: boolean
}

interface RowHead {
  text: string
  depth: number
  group: boolean
  open: boolean
  valueText: string
  firstOfNode: boolean
  /** The tabular layout's labels, by row field; empty in the compact layout. */
  parts: (RowHeadPart | null)[]
}

/** Whether a line opens or closes a group from its row header: a group's line, or its total's. */
/** Whether a line opens and closes its group; a subtotal after the children (tabular) does not. */
const lineToggles = (line: PivotLine) =>
  (line.kind === 'group' || (line.kind === 'subtotal' && !tabular.value)) &&
  rowTree.value.isGroup(line.node)

function rowHead(line: PivotLine, index: number): RowHead {
  const tree = rowTree.value
  const group = lineToggles(line)
  const head: RowHead = {
    text:
      line.kind === 'total'
        ? messages.value.total
        : line.kind === 'subtotal'
          ? format(messages.value.subtotalRow, {
              label: nodeText(tree, rowWriters.value, line.node),
            })
          : nodeText(tree, rowWriters.value, line.node),
    depth: line.kind === 'total' ? 0 : tree.depth[line.node]! - 1,
    group,
    open: group && !rowCollapsed.value.has(line.node),
    valueText: line.value >= 0 ? valueDisplay.value[line.value]!.label : '',
    firstOfNode: isFirstOfNode(line),
    parts: [],
  }
  if (!tabular.value || !head.firstOfNode) return head
  const parts: (RowHeadPart | null)[] = Array.from({ length: tree.levels.length }, () => null)
  if (line.kind === 'total' || line.kind === 'subtotal') {
    parts[head.depth] = { text: head.text, toggle: group ? line.node : -1, open: head.open }
  } else {
    // a group's label shows on the first line inside it
    const before = index > 0 ? bodyLines.value[index - 1] : undefined
    for (let at = line.node; at > 0; at = tree.parent[at]!) {
      const level = tree.depth[at]! - 1
      if (at !== line.node && before && before.kind !== 'total' && tree.within(before.node, at))
        break
      const isGroup = tree.isGroup(at)
      parts[level] = {
        text: nodeText(tree, rowWriters.value, at),
        toggle: isGroup ? at : -1,
        open: isGroup && !rowCollapsed.value.has(at),
      }
    }
  }
  head.parts = parts
  return head
}

interface Cell {
  key: number
  /** In the selected range. */
  selected: boolean
  text: string
  cls: string
  col: number
  style: string
}

/** Where a mark puts a value: a bar's start and size, or a tint's depth, from 0 to 1. */
function markStyle(value: number, valueIndex: number) {
  const { mark, show } = valueDisplay.value[valueIndex]!
  if (!mark) return ''
  const { min, max } = result.value.range(valueIndex, show)
  if (min !== min) return ''
  const tone = `--dou-pivot-tone:var(--dou-color-${mark.tone})`
  if (mark.type === 'scale') {
    const depth = max === min ? 1 : (value - min) / (max - min)
    return `;${tone};--dou-pivot-mark:${depth.toFixed(3)}`
  }
  // bars grow from zero, to the left for values below it
  const lo = Math.min(0, min)
  const span = Math.max(0, max) - lo || 1
  const start = (Math.min(value, 0) - lo) / span
  return `;${tone};--dou-pivot-bar-start:${start.toFixed(3)};--dou-pivot-bar-size:${(Math.abs(value) / span).toFixed(3)}`
}

function rowCells(line: PivotLine, row: number): Cell[] {
  const res = result.value
  const sel = selection.value
  const picked = sel && row >= sel.top && row <= sel.bottom ? sel : null
  const blank = rowBlank(line)
  const display = valueDisplay.value
  const starts = colStarts.value
  // marks go on the innermost cells, never on subtotals and totals
  // (without fields on an axis, its grand total is its innermost group)
  const innerRow = res.rows.depth[line.node] === res.rows.levels.length && !blank
  return visibleCols.value.map(({ line: col, index }) => {
    const v = line.value >= 0 ? line.value : Math.max(0, col.value)
    const n = blank ? Number.NaN : res.shown(line.node, col.node, v, display[v]!.show)
    let cls = 'dou-pivot__cell'
    if (col.kind !== 'group') cls += ' is-total'
    if (col.kind === 'group' && col.node > 0 && res.columns.isGroup(col.node)) cls += ' is-closed'
    const selected = !!picked && index >= picked.left && index <= picked.right
    if (selected) cls += ' is-selected'
    if (col.node === highlightCol.value) cls += ' is-highlighted'
    let style = `width:${starts[index + 1]! - starts[index]!}px`
    const mark = display[v]!.mark
    if (mark && innerRow && n === n && res.columns.depth[col.node] === res.columns.levels.length) {
      cls += mark.type === 'bar' ? ' has-bar' : ' has-scale'
      style += markStyle(n, v)
    }
    return { key: index, col: index, text: display[v]!.write(n), cls, style, selected }
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
  /** The column whose width its edge sets, or -1. */
  resize: number
}

/** What a header cell says: a group, a subtotal, the grand total or a value. */
function spanText(span: PivotHeaderSpan) {
  const tree = result.value.columns
  if (span.kind === 'value')
    return span.value >= 0 ? valueDisplay.value[span.value]!.label : messages.value.total
  if (span.kind === 'total') return messages.value.total
  if (span.kind === 'subtotal')
    return format(messages.value.subtotal, { label: nodeText(tree, colWriters.value, span.node) })
  return nodeText(tree, colWriters.value, span.node)
}

const columnPath = (line: { kind: string; node: number }) =>
  line.kind === 'total' ? [] : result.value.columns.path(line.node)

const headCells = computed<HeadCell[]>(() => {
  const tree = result.value.columns
  const starts = colStarts.value
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
        sortable &&
        sort &&
        sort.valueIndex === value &&
        samePath(sort.column ?? [], columnPath(line))
          ? sort.order
          : null
      const canToggle = span.kind === 'group' && tree.isGroup(span.node)
      const text = spanText(span)
      let cls = `dou-pivot__col-head is-${span.kind}`
      // over the numbers, names sit right like them; a group with a toggle reads from the left
      if (span.kind !== 'group' || (!canToggle && single)) cls += ' is-end'
      if (span.kind === 'value' && line.kind !== 'group') cls += ' is-total'
      if (sorted) cls += ' is-sorted'
      out.push({
        key: `${span.level}:${span.from}:${span.kind}`,
        span,
        text,
        style: `left:${starts[span.from]}px;top:${span.level * h}px;width:${starts[span.to]! - starts[span.from]!}px;height:${span.rows * h}px`,
        resize: reachesBottom && single && props.resizable ? span.from : -1,
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

const rowFieldNames = computed(() => rowFields.value.map((f) => f.label).join(' / '))
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
  const same = current && current.valueIndex === value && samePath(current.column ?? [], column)
  // descending first (largest on top), then ascending, then back to the labels
  const order = !same ? 'desc' : current!.order === 'desc' ? 'asc' : null
  config.value = { ...config.value, sort: order ? { valueIndex: value, column, order } : null }
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
  const label = nodeText(tree, axis === 'rows' ? rowWriters.value : colWriters.value, node)
  announce(format(open ? messages.value.expanded : messages.value.collapsed, { label }))
  if (!all) return toggle(axis, tree.path(node), open)
  // Alt: every group at the same depth goes the same way
  const depth = tree.depth[node]!
  const same: PivotPath[] = []
  for (let at = 1; at < tree.size; at++)
    if (tree.depth[at] === depth && tree.isGroup(at)) same.push(tree.path(at))
  const rest = (collapsed.value[axis] ?? []).filter((p) => !same.some((q) => samePath(p, q)))
  setCollapsed(axis, open ? rest : [...rest, ...same])
}

function expandAll({ axis }: { axis?: PivotAxis } = {}) {
  const next = { ...collapsed.value }
  for (const a of axis ? [axis] : (['rows', 'columns'] as const)) next[a] = []
  collapsed.value = next
}

function collapseAll({ axis, depth = 1 }: { axis?: PivotAxis; depth?: number } = {}) {
  const next = { ...collapsed.value }
  for (const a of axis ? [axis] : (['rows', 'columns'] as const))
    next[a] = groupPaths(a === 'rows' ? result.value.rows : result.value.columns, depth)
  collapsed.value = next
}

// ---- column widths ----

let justResized = false
const MIN_COLUMN = 56
const MAX_COLUMN = 640

/** A column's width, or the row headers' for `-1`. */
const widthOf = (col: number) =>
  col < 0 ? rowHeadWidth.value : colStarts.value[col + 1]! - colStarts.value[col]!
const minWidthOf = (col: number) => (col < 0 ? 80 * rowLevelCount.value : MIN_COLUMN)
const maxWidthOf = (col: number) => (col < 0 ? 480 * rowLevelCount.value : MAX_COLUMN)

function setWidth(col: number, width: number) {
  const w = Math.round(Math.min(Math.max(width, minWidthOf(col)), maxWidthOf(col)))
  if (col < 0) {
    rowHeadDragged.value = w
    return
  }
  const next = new Map(dragged.value)
  next.set(colKey(colLines.value[col]!), w)
  dragged.value = next
}

/** Dragging the edge of a column header (or of the corner, for the row headers). */
function onResizeDown(event: PointerEvent) {
  const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-resize]')
  if (!handle || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const col = Number(handle.dataset.resize)
  const startX = event.clientX
  const from = widthOf(col)
  let moved = false
  handle.setPointerCapture?.(event.pointerId)
  const onMove = (e: PointerEvent) => {
    const dx = e.clientX - startX
    if (!moved && Math.abs(dx) < 2) return
    moved = true
    setWidth(col, from + dx)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    if (moved) {
      // the click that follows the drag is not a sort
      justResized = true
      setTimeout(() => (justResized = false))
    }
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

const measurer = ref<HTMLElement>()
/** The widest of some texts in the table's font, measured once by the browser. */
function widest(texts: string[]) {
  const el = measurer.value
  if (!el) return 0
  // the longest few by length; measuring every text would cost a layout each
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const top = [...new Set(texts)].sort((a, b) => b.length - a.length).slice(0, 12)
  let max = 0
  for (const text of top) {
    el.textContent = text
    max = Math.max(max, el.getBoundingClientRect().width)
  }
  el.textContent = ''
  return Math.ceil(max)
}

/** Double-clicking a column's edge fits it to its numbers and its header; the corner's goes back to its width. */
function onResizeFit(event: MouseEvent) {
  const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-resize]')
  if (!handle) return
  event.stopPropagation()
  fitWidth(Number(handle.dataset.resize))
}

function fitWidth(col: number) {
  if (col < 0) {
    rowHeadDragged.value = 0
    return
  }
  const column = colLines.value[col]!
  const display = valueDisplay.value
  const res = result.value
  const lines = allLines.value
  const texts: string[] = []
  const limit = Math.min(lines.length, 5000)
  for (let i = 0; i < limit; i++) {
    const line = lines[i]!
    const v = line.value >= 0 ? line.value : Math.max(0, column.value)
    texts.push(display[v]!.write(rowBlank(line) ? Number.NaN : res.get(line.node, column.node, v)))
  }
  const head = headCells.value.find((c) => c.resize === col)
  const textWidth = widest(texts)
  const headWidthNeeded = head ? widest([head.text]) + (head.sorted ? 16 : 0) : 0
  const next = new Map(dragged.value)
  next.set(
    colKey(column),
    Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, Math.max(textWidth, headWidthNeeded) + 26)),
  )
  dragged.value = next
}

/** The keys on a focused edge: the arrows resize it (Shift for bigger steps), Enter fits it. */
function onResizeKeydown(event: KeyboardEvent) {
  const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-resize]')
  if (!handle || event.key === 'Tab') return
  // the table's own keys stay off while an edge has the focus
  event.stopPropagation()
  const col = Number(handle.dataset.resize)
  const step = event.shiftKey ? 32 : 8
  if (event.key === 'ArrowLeft') setWidth(col, widthOf(col) - step)
  else if (event.key === 'ArrowRight') setWidth(col, widthOf(col) + step)
  else if (event.key === 'Enter') fitWidth(col)
  else return
  event.preventDefault()
}

/** One edge takes Tab: that of the active cell's column, or the row headers'. */
const resizeStop = computed(() => {
  const col = active.value?.col ?? -1
  return col >= 0 && col < colLines.value.length ? col : -1
})

// ---- pointer and keys ----

const active = shallowRef<{ row: number; col: number } | null>(null)
const focused = ref(false)
/** Where a range of cells starts; the active cell is its other corner. */
const anchor = shallowRef<{ row: number; col: number } | null>(null)
/** The selected range, rows and columns from first to last (column -1 is the row headers); null for one cell. */
const selection = computed(() => {
  const a = anchor.value
  const b = active.value
  if (!a || !b || (a.row === b.row && a.col === b.col)) return null
  return {
    top: Math.min(a.row, b.row),
    bottom: Math.max(a.row, b.row),
    left: Math.min(a.col, b.col),
    right: Math.max(a.col, b.col),
  }
})
/** What a screen reader reads out: a range picked, cells copied, a group opened. */
const announcement = ref('')
let announceTimer: ReturnType<typeof setTimeout> | undefined
function announce(text: string, delay = 0) {
  clearTimeout(announceTimer)
  // cleared first, so the same words twice are read twice
  announcement.value = ''
  announceTimer = setTimeout(() => (announcement.value = text), delay || 50)
}
// read out once the range stops growing, not on every step
watch(selection, (sel) => {
  if (!sel) return
  announce(
    format(messages.value.selected, {
      rows: sel.bottom - sel.top + 1,
      columns: sel.right - sel.left + 1,
    }),
    400,
  )
})
onBeforeUnmount(() => clearTimeout(announceTimer))

/** The selected columns of a row, as `left:right`; empty when the row is not in the range. */
const selectedIn = (row: number) => {
  const sel = selection.value
  return sel && row >= sel.top && row <= sel.bottom ? `${sel.left}:${sel.right}` : ''
}
const allLines = computed(() => [...bodyLines.value, ...footLines.value])

/** The highlighted groups' nodes, -1 when there is none (or its path matches no group). */
const highlightRow = computed(() => {
  const path = props.highlight?.row
  return path?.length ? result.value.rows.find(path) || -1 : -1
})
const highlightCol = computed(() => {
  const path = props.highlight?.column
  return path?.length ? result.value.columns.find(path) || -1 : -1
})

const cellId = (row: number, col: number) => `${uid}-${row}-${col}`
const activeId = computed(() => {
  const a = active.value
  if (!a || !focused.value) return undefined
  return cellId(a.row, a.col)
})

function cellEvent(row: PivotLine, col: PivotLine): PivotCellEvent<Row> {
  const res = result.value
  const src = source.value
  const valueIndex = row.value >= 0 ? row.value : Math.max(0, col.value)
  const indices = () => res.indices(row.node, col.node)
  return {
    row: row.kind === 'total' ? [] : res.rows.path(row.node),
    column: col.kind === 'total' ? [] : res.columns.path(col.node),
    labels: {
      row: row.kind === 'total' ? [] : pathTexts(res.rows, rowWriters.value, row.node),
      column: col.kind === 'total' ? [] : pathTexts(res.columns, colWriters.value, col.node),
    },
    valueIndex,
    value: rowBlank(row)
      ? Number.NaN
      : res.shown(row.node, col.node, valueIndex, valueDisplay.value[valueIndex]?.show ?? null),
    records: () => indices().map((i) => src.record(i) as Row),
    indices,
  }
}

/** Set while a drag (or a Shift+click) picks a range, so the click that ends it opens nothing. */
let swept = false

/** Pressing on a cell and dragging picks a range; Shift+click grows it. Touch scrolls instead. */
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || event.pointerType === 'touch') return
  const target = event.target as HTMLElement
  if (target.closest('[data-resize], [data-head], [data-toggle-node], [data-sort-field]')) return
  const el = target.closest<HTMLElement>('[data-row]')
  const view = viewport.value
  if (!el || !view) return
  // no text selection while dragging; the table takes the focus itself
  event.preventDefault()
  view.focus({ preventScroll: true })
  const start = { row: Number(el.dataset.row), col: Number(el.dataset.col) }
  if (event.shiftKey) {
    anchor.value ??= active.value ?? start
    active.value = start
    swept = true
    setTimeout(() => (swept = false))
    return
  }
  anchor.value = null
  const onMove = (e: PointerEvent) => {
    // near an edge the table scrolls on
    const box = view.getBoundingClientRect()
    if (e.clientY > box.bottom - 24) view.scrollTop += 16
    else if (e.clientY < box.top + headHeight.value + 8) view.scrollTop -= 16
    if (e.clientX > box.right - 24) view.scrollLeft += 16
    else if (e.clientX < box.left + headWidth.value + 8 && start.col >= 0) view.scrollLeft -= 16
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row]')
    if (!hit || !view.contains(hit)) return
    const at = { row: Number(hit.dataset.row), col: Number(hit.dataset.col) }
    if (!swept && at.row === start.row && at.col === start.col) return
    swept = true
    anchor.value = start
    if (active.value?.row !== at.row || active.value?.col !== at.col) active.value = at
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    setTimeout(() => (swept = false))
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('[data-resize]') || justResized || swept) return
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
  anchor.value = null
  const line = allLines.value[row]
  if (!line) return
  if (col < 0) {
    const part = target.closest<HTMLElement>('[data-toggle-node]')
    if (part) toggleNode('rows', Number(part.dataset.toggleNode), event.altKey)
    else if (lineToggles(line)) toggleNode('rows', line.node, event.altKey)
    return
  }
  const column = colLines.value[col]
  if (column) emit('cellClick', cellEvent(line, column))
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
    const starts = colStarts.value
    const space = viewWidth.value - headWidth.value
    if (starts[col]! < el.scrollLeft) el.scrollLeft = starts[col]!
    else if (starts[col + 1]! > el.scrollLeft + space) el.scrollLeft = starts[col + 1]! - space
  }
  onScroll()
}

/** Moves the active cell; `extend` (Shift) grows the range from where it started instead. */
function moveTo(row: number, col: number, extend = false) {
  const rows = allLines.value.length
  const cols = colLines.value.length
  if (rows === 0) return
  const next = {
    row: Math.max(0, Math.min(rows - 1, row)),
    col: Math.max(-1, Math.min(cols - 1, col)),
  }
  if (extend) anchor.value ??= active.value ?? next
  else anchor.value = null
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
  // in the tabular layout a group's own line is its total, after its children
  for (let i = row + 1; i < lines.length; i++) if (lines[i]!.node === parent) return i
  return row
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  const a = active.value ?? { row: 0, col: -1 }
  const line = allLines.value[a.row]
  const isGroup = !!line && lineToggles(line)
  const open = isGroup && !rowCollapsed.value.has(line!.node)
  const page = Math.max(1, Math.floor((viewHeight.value - headHeight.value) / rowHeight.value) - 1)
  const mod = event.ctrlKey || event.metaKey
  const shift = event.shiftKey
  if (mod && !shift && !event.altKey && event.key.toLowerCase() === 'a') {
    selectAll()
    event.preventDefault()
    return
  }
  switch (event.key) {
    case 'ArrowDown':
      moveTo(a.row + 1, a.col, shift)
      break
    case 'ArrowUp':
      moveTo(a.row - 1, a.col, shift)
      break
    case 'ArrowRight':
      if (a.col < 0 && isGroup && !open && !shift) toggleNode('rows', line!.node)
      else moveTo(a.row, a.col + 1, shift)
      break
    case 'ArrowLeft':
      if (shift) moveTo(a.row, a.col - 1, true)
      else if (a.col < 0 && open) toggleNode('rows', line!.node)
      else if (a.col < 0 && line) moveTo(parentRow(a.row), -1)
      else moveTo(a.row, a.col - 1)
      break
    case 'PageDown':
      moveTo(a.row + page, a.col, shift)
      break
    case 'PageUp':
      moveTo(a.row - page, a.col, shift)
      break
    case 'Home':
      moveTo(mod ? 0 : a.row, -1, shift)
      break
    case 'End':
      moveTo(mod ? allLines.value.length - 1 : a.row, colLines.value.length - 1, shift)
      break
    case 'Escape':
      if (!anchor.value) return
      anchor.value = null
      break
    case 'Enter':
    case ' ':
      if (!line) return
      if (a.col < 0) {
        if (isGroup) toggleNode('rows', line.node, event.altKey)
      } else if (event.key === 'Enter') {
        const column = colLines.value[a.col]
        if (column) emit('cellClick', cellEvent(line, column))
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

// The active cell's row and column by their groups, so that it stays on the
// same groups when the data changes and lines come and go.
const rowKey = (line: PivotLine | undefined) =>
  line
    ? `${line.kind}|${line.value}|${line.kind === 'total' ? '' : JSON.stringify(result.value.rows.path(line.node))}`
    : ''
let activeKeys: { row: string; col: string } | null = null
watch(
  active,
  (a) => {
    activeKeys = a
      ? { row: rowKey(allLines.value[a.row]), col: a.col < 0 ? '' : colKey(colLines.value[a.col]!) }
      : null
  },
  { flush: 'sync' },
)
watch([allLines, colLines], ([rows, cols]) => {
  const a = active.value
  const keys = activeKeys
  if (!a || !keys) return
  // most changes leave it where it was; look further only when they don't
  let row =
    rowKey(rows[a.row]) === keys.row ? a.row : rows.findIndex((line) => rowKey(line) === keys.row)
  if (row < 0) row = Math.min(a.row, rows.length - 1)
  let col = !keys.col
    ? -1
    : a.col >= 0 && cols[a.col] && colKey(cols[a.col]!) === keys.col
      ? a.col
      : cols.findIndex((line) => colKey(line) === keys.col)
  if (col < 0 && keys.col) col = Math.min(a.col, cols.length - 1)
  if (row < 0) active.value = null
  else if (row !== a.row || col !== a.col) {
    active.value = { row, col }
    anchor.value = null
    // it moved with its groups: bring it into view where the lines now put it
    nextTick(() => ensureVisible(row, col))
  }
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

// ---- the table as cells: copying, CSV, a sheet, a chart and printing ----

/** The column headers for export, which always name the values when they run along the columns. */
const exportSpans = computed(() =>
  headerSpans(
    result.value.columns,
    colLines.value,
    result.value.columns.levels.length === 0 || !valuesOnRows.value,
  ),
)

interface GridRange {
  top: number
  bottom: number
  left: number
  right: number
}

/** A row's labels, one per row field: the group on its own line, as the table shows it. */
function rowLabels(line: PivotLine, index: number, count: number) {
  const texts: string[] = Array.from({ length: count }, () => '')
  if (line.kind === 'total') texts[0] = messages.value.total
  else if (isFirstOfNode(line)) {
    const head = rowHead(line, index)
    if (tabular.value) head.parts.forEach((part, level) => part && (texts[level] = part.text))
    else texts[head.depth] = head.text
  }
  return texts
}

/**
 * Cells of the table: rows `top` to `bottom`, columns `left` to `right`
 * (`-1` takes the row headers), with the column headers when `heads`.
 */
function gridOf(range: GridRange, heads: boolean): PivotGrid {
  const res = result.value
  const display = valueDisplay.value
  const levels = Math.max(1, res.rows.levels.length)
  const withLeft = range.left < 0
  const headCols = withLeft ? levels + (valuesOnRows.value ? 1 : 0) : 0
  const from = Math.max(0, range.left)
  const to = range.right
  const width = headCols + Math.max(0, to - from + 1)
  const cells: (PivotGridCell | null)[][] = []
  const headRowCount = heads ? res.columns.levels.length + 1 : 0
  for (let r = 0; r < headRowCount; r++)
    cells.push(Array.from({ length: width }, (): PivotGridCell => ({ text: '', kind: 'head' })))
  if (heads && withLeft) {
    columnFields.value.forEach((label, level) => (cells[level]![0] = { text: label, kind: 'head' }))
    const last = cells[headRowCount - 1]!
    for (const field of rowFields.value) last[field.index] = { text: field.label, kind: 'head' }
    if (valuesOnRows.value) last[levels] = { text: messages.value.values, kind: 'head' }
  }
  if (heads) {
    for (const list of exportSpans.value) {
      for (const span of list) {
        const a = Math.max(span.from, from)
        const b = Math.min(span.to - 1, to)
        if (a > b) continue
        const col = headCols + a - from
        const cell: PivotGridCell = { text: spanText(span), kind: 'head' }
        const line = colLines.value[span.from]!
        if (span.kind === 'total' || span.kind === 'subtotal' || line.kind !== 'group')
          cell.total = true
        if (b > a) cell.colSpan = b - a + 1
        if (span.rows > 1) cell.rowSpan = span.rows
        for (let r = span.level; r < span.level + span.rows; r++)
          for (let c = col; c <= col + b - a; c++) cells[r]![c] = null
        cells[span.level]![col] = cell
      }
    }
  }
  const lines = allLines.value
  for (let i = range.top; i <= range.bottom; i++) {
    const line = lines[i]
    if (!line) continue
    const out: (PivotGridCell | null)[] = []
    // a group's own line holds its total
    const lineTotal = line.kind !== 'group' || (line.node > 0 && res.rows.isGroup(line.node))
    const mark = lineTotal ? { total: true } : {}
    if (withLeft) {
      for (const text of rowLabels(line, i, levels)) out.push({ text, kind: 'label', ...mark })
      if (valuesOnRows.value)
        out.push({
          text: line.value >= 0 ? display[line.value]!.label : '',
          kind: 'label',
          ...mark,
        })
    }
    const blank = rowBlank(line)
    for (let c = from; c <= to; c++) {
      const col = colLines.value[c]!
      const v = line.value >= 0 ? line.value : Math.max(0, col.value)
      const n = blank ? Number.NaN : res.shown(line.node, col.node, v, display[v]!.show)
      const total =
        lineTotal || col.kind !== 'group' || (col.node > 0 && res.columns.isGroup(col.node))
      out.push({
        text: display[v]!.write(n),
        kind: 'value',
        value: n,
        valueIndex: v,
        ...(total ? { total: true } : {}),
      })
    }
    cells.push(out)
  }
  const widths: number[] = []
  if (withLeft) {
    const own = tabular.value
      ? levelWidth.value
      : levels === 1
        ? rowHeadWidth.value
        : Math.max(80, Math.round(props.rowHeaderWidth * 0.6))
    for (let l = 0; l < levels; l++) widths.push(own)
    if (valuesOnRows.value) widths.push(VALUE_HEADER_WIDTH)
  }
  const starts = colStarts.value
  for (let c = from; c <= to; c++) widths.push(starts[c + 1]! - starts[c]!)
  return {
    cells,
    headRows: headRowCount,
    headCols,
    formats: display.map((d) => d.sheetFormat),
    widths,
  }
}

const wholeRange = (): GridRange => ({
  top: 0,
  bottom: allLines.value.length - 1,
  left: -1,
  right: colLines.value.length - 1,
})

/** The whole table, headers and all, as cells. */
const toGrid = () => gridOf(wholeRange(), true)

/**
 * What copying takes: the selected range, or the active cell. A range over
 * the whole table brings the column headers along.
 */
function copyGrid(all = false): PivotGrid | null {
  if (all) return toGrid()
  const range: GridRange | null =
    selection.value ??
    (active.value
      ? {
          top: active.value.row,
          bottom: active.value.row,
          left: active.value.col,
          right: active.value.col,
        }
      : null)
  if (!range) return null
  const whole = wholeRange()
  const isWhole =
    range.top === 0 &&
    range.bottom === whole.bottom &&
    range.left === -1 &&
    range.right === whole.right
  return gridOf(range, isWhole)
}

/** Selects every cell, the row headers too (Ctrl / ⌘ + A). */
function selectAll() {
  const whole = wholeRange()
  if (whole.bottom < 0) return
  anchor.value = { row: 0, col: -1 }
  active.value = { row: whole.bottom, col: whole.right }
}

/** Copying puts tab-separated text and a table on the clipboard; pasted into DouSheet, numbers keep their formats. */
function onCopy(event: ClipboardEvent) {
  const grid = copyGrid()
  if (!grid || !event.clipboardData) return
  event.preventDefault()
  event.clipboardData.setData('text/plain', gridToTSV(grid))
  event.clipboardData.setData('text/html', gridToHTML(grid, { sheet: true }))
  announceCopied(grid)
}

function announceCopied(grid: PivotGrid) {
  let cells = 0
  for (const row of grid.cells) for (const cell of row) if (cell) cells++
  announce(format(messages.value.copied, { cells }))
}

async function copy(options: PivotCopyOptions = {}) {
  const grid = copyGrid(options.all)
  if (!grid) return
  const text = gridToTSV(grid)
  const html = gridToHTML(grid, { sheet: true })
  const clipboard = navigator.clipboard
  if (typeof ClipboardItem !== 'undefined' && clipboard?.write) {
    await clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
  } else await clipboard.writeText(text)
  announceCopied(grid)
}

const toCSV = (options?: PivotCSVOptions) => gridToCSV(toGrid(), options)

function toSheet(options: { name?: string } = {}): PivotSheetWorkbook {
  const grid = toGrid()
  const colSizes: Record<number, number> = {}
  grid.widths.forEach((w, i) => (colSizes[i] = w))
  return {
    version: 1,
    sheets: [
      {
        name: options.name ?? messages.value.pivot,
        cells: gridToSheetCells(grid),
        merges: gridMerges(grid),
        freeze: { rows: grid.headRows, cols: grid.headCols },
        colSizes,
      },
    ],
    styles: structuredClone(SHEET_STYLES),
  }
}

/**
 * Rows for a chart: a row per group on show that is not open (its children
 * would be the rows instead), a series per column the same way; the
 * subtotals and totals are left out.
 */
function toChartRows(options: PivotChartRowsOptions = {}): PivotChartRows {
  const res = result.value
  const display = valueDisplay.value
  const { valueIndex } = options
  const many = display.length > 1
  const series = colLines.value
    .map((line, col) => ({ line, col }))
    .filter(({ line }) =>
      res.columns.levels.length === 0 ? line.kind === 'total' : line.kind === 'group',
    )
    .filter(({ line }) => valueIndex === undefined || line.value < 0 || line.value === valueIndex)
    .map(({ line }, i) => {
      const v = line.value >= 0 ? line.value : (valueIndex ?? 0)
      const group = line.kind === 'total' ? '' : pathText(res.columns, colWriters.value, line.node)
      const value = display[v]!.label
      const name = group ? (many && !valuesOnRows.value ? join([group, value]) : group) : value
      return { key: `s${i}`, name, valueIndex: v, node: line.node, format: display[v]!.write }
    })
  const lines = res.rows.levels.length === 0 ? footLines.value : bodyLines.value
  const rows: Record<string, string | number | null>[] = []
  for (const line of lines) {
    if (res.rows.levels.length > 0) {
      if (line.kind !== 'group') continue
      if (res.rows.isGroup(line.node) && !rowCollapsed.value.has(line.node)) continue
    }
    if (valuesOnRows.value && line.value !== (valueIndex ?? 0)) continue
    const row: Record<string, string | number | null> = {
      label:
        line.kind === 'total'
          ? messages.value.total
          : pathText(res.rows, rowWriters.value, line.node),
    }
    for (const s of series) {
      const v = valuesOnRows.value ? line.value : s.valueIndex
      const n = res.shown(line.node, s.node, v, display[v]!.show)
      row[s.key] = n === n ? n : null
    }
    rows.push(row)
  }
  return {
    x: 'label',
    rows,
    series: series.map(({ key, name, valueIndex: v, format: write }) => {
      const at = valuesOnRows.value ? (valueIndex ?? 0) : v
      return { key, name, valueIndex: at, format: valuesOnRows.value ? display[at]!.write : write }
    }),
  }
}

const join = (texts: string[]) => texts.join(' · ')
/** A group's labels from the outermost in, as one text. */
function pathTexts(tree: PivotTree, writers: ((v: unknown) => string)[], node: number) {
  const texts: string[] = []
  for (let at = node; at > 0; at = tree.parent[at]!) texts.unshift(nodeText(tree, writers, at))
  return texts
}
const pathText = (tree: PivotTree, writers: ((v: unknown) => string)[], node: number) =>
  join(pathTexts(tree, writers, node))
const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A4 less 10mm margins, in px at 96 per inch. */
const PAGE_WIDTH = { portrait: 718, landscape: 1047 }

function print(options: PivotPrintOptions = {}) {
  const grid = toGrid()
  const orientation =
    options.orientation ??
    (grid.widths.reduce((a, b) => a + b, 0) > PAGE_WIDTH.portrait ? 'landscape' : 'portrait')
  const title = options.title ?? ariaLabel.value
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  document.body.append(iframe)
  const doc = iframe.contentDocument!
  const font = root.value ? getComputedStyle(root.value).fontFamily : 'sans-serif'
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title || document.title)}</title><style>` +
      `@page{size:A4 ${orientation};margin:10mm}` +
      `html,body{margin:0;color:#1f1f1f;font:10px/1.4 ${font};font-variant-numeric:tabular-nums}` +
      `h1{margin:0 0 8px;font-size:13px;font-weight:600}` +
      `table{border-collapse:collapse;width:100%}` +
      `thead{display:table-header-group}tr{break-inside:avoid}` +
      `th,td{border:1px solid #d6d6d6;padding:3px 6px;white-space:nowrap}` +
      `th{background:#f5f5f5;font-weight:500;text-align:left}` +
      `tbody th{background:none}.is-total{font-weight:600}` +
      `thead th.is-end{text-align:right}` +
      `*{print-color-adjust:exact;-webkit-print-color-adjust:exact}` +
      `</style></head><body>${title ? `<h1>${escape(title)}</h1>` : ''}${gridToHTML(grid)}</body></html>`,
  )
  doc.close()
  const win = iframe.contentWindow!
  const done = () => iframe.remove()
  win.addEventListener('afterprint', done)
  // browsers that print without a dialog, or never send afterprint
  setTimeout(done, 60_000)
  win.focus()
  win.print()
}

const ariaLabel = computed(() => props.ariaLabel ?? messages.value.pivot)
const rootStyle = computed(() => {
  const height = typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight
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
  toGrid,
  toCSV,
  toSheet,
  toChartRows,
  copy,
  print,
  selectAll,
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
        'is-tabular': tabular,
        'is-busy': busy,
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
      aria-multiselectable="true"
      :aria-activedescendant="activeId"
      :aria-busy="busy || undefined"
      @scroll="onScroll"
      @pointerdown="onPointerDown"
      @click="onClick"
      @copy="onCopy"
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
                <span
                  v-if="field.index > 0 && !tabular"
                  class="dou-pivot__corner-sep"
                  aria-hidden="true"
                  >/</span
                >
                <span
                  :class="
                    tabular
                      ? [
                          'dou-pivot__corner-field',
                          { 'is-last': field.index === rowFields.length - 1 },
                        ]
                      : 'dou-pivot__corner-inline'
                  "
                  :style="tabular ? `width:${levelWidth}px` : undefined"
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
                    <ArrowDownIcon
                      v-if="!config.sort && field.sort === 'desc'"
                      aria-hidden="true"
                    />
                  </button>
                </span>
              </template>
              <span v-if="valuesOnRows" class="dou-pivot__corner-values">{{
                messages.values
              }}</span>
              <span v-else-if="!valueRow" class="dou-pivot__corner-values">{{
                valueDisplay[0]!.label
              }}</span>
            </div>
            <span
              v-if="resizable"
              class="dou-pivot__resize"
              data-resize="-1"
              role="separator"
              aria-orientation="vertical"
              :aria-label="format(messages.columnWidth, { column: rowFieldNames })"
              :aria-valuenow="widthOf(-1)"
              :aria-valuemin="minWidthOf(-1)"
              :aria-valuemax="maxWidthOf(-1)"
              :tabindex="resizeStop === -1 ? 0 : -1"
              :title="messages.resizeColumn"
              @pointerdown="onResizeDown"
              @dblclick="onResizeFit"
              @keydown="onResizeKeydown"
            />
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
              <span
                v-if="cell.resize >= 0"
                class="dou-pivot__resize"
                :data-resize="cell.resize"
                role="separator"
                aria-orientation="vertical"
                :aria-label="format(messages.columnWidth, { column: cell.text })"
                :aria-valuenow="widthOf(cell.resize)"
                :aria-valuemin="MIN_COLUMN"
                :aria-valuemax="MAX_COLUMN"
                :tabindex="resizeStop === cell.resize ? 0 : -1"
                :title="messages.resizeColumn"
                @pointerdown="onResizeDown"
                @dblclick="onResizeFit"
                @keydown="onResizeKeydown"
              />
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
              colStarts,
              rowHeadWidth,
              tabular,
              valueDisplay,
              rowWriters,
              active?.row === index ? active.col : -9,
              selectedIn(index),
              highlightCol,
              line.node === highlightRow,
            ]"
            class="dou-pivot__row"
            :class="{
              'is-group': lineToggles(line),
              'is-subtotal': line.kind === 'subtotal',
              'is-node-start': line.value <= 0,
              'is-highlighted': line.node === highlightRow,
            }"
            role="row"
            :aria-rowindex="headRows + index + 1"
            :aria-level="rowTree.depth[line.node]"
            :aria-expanded="lineToggles(line) ? !rowCollapsed.has(line.node) : undefined"
            :style="`top:${index * rowHeight}px;width:${totalWidth}px`"
          >
            <template v-for="head in [rowHead(line, index)]" :key="0">
              <div
                :id="cellId(index, -1)"
                class="dou-pivot__row-head"
                :class="{
                  'is-active': active?.row === index && active.col === -1,
                  'is-clickable': head.group,
                  'is-selected': selectedIn(index).startsWith('-1:'),
                }"
                role="rowheader"
                :aria-selected="selectedIn(index).startsWith('-1:') || undefined"
                :data-row="index"
                data-col="-1"
                :style="
                  tabular
                    ? `width:${rowHeadWidth}px;padding-left:0`
                    : `width:${rowHeadWidth}px;padding-left:${12 + head.depth * 16}px`
                "
              >
                <template v-if="tabular">
                  <span
                    v-for="(part, level) in head.parts"
                    :key="level"
                    class="dou-pivot__level"
                    :style="`width:${levelWidth}px`"
                  >
                    <template v-if="part">
                      <span
                        v-if="part.toggle > 0"
                        class="dou-pivot__toggle"
                        :class="{ 'is-open': part.open }"
                        :data-toggle-node="part.toggle"
                        aria-hidden="true"
                      >
                        <ChevronRightIcon />
                      </span>
                      <span
                        v-else-if="level < head.parts.length - 1"
                        class="dou-pivot__toggle-space"
                      />
                      <span class="dou-pivot__text">{{ part.text }}</span>
                    </template>
                  </span>
                </template>
                <template v-else-if="head.firstOfNode">
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
            <div class="dou-pivot__spacer" :style="`width:${colStarts[colWindow.from]}px`" />
            <div
              v-for="cell in rowCells(line, index)"
              :id="cellId(index, cell.col)"
              :key="cell.key"
              :class="[cell.cls, { 'is-active': active?.row === index && active.col === cell.col }]"
              role="gridcell"
              :aria-selected="cell.selected || undefined"
              :aria-colindex="cell.col + (valuesOnRows ? 3 : 2)"
              :data-row="index"
              :data-col="cell.col"
              :style="cell.style"
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
              :class="{
                'is-active': active?.row === index && active.col === -1,
                'is-selected': selectedIn(index).startsWith('-1:'),
              }"
              role="rowheader"
              :aria-selected="selectedIn(index).startsWith('-1:') || undefined"
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
            <div class="dou-pivot__spacer" :style="`width:${colStarts[colWindow.from]}px`" />
            <div
              v-for="cell in rowCells(line, index)"
              :id="cellId(index, cell.col)"
              :key="cell.key"
              :class="[cell.cls, { 'is-active': active?.row === index && active.col === cell.col }]"
              role="gridcell"
              :aria-selected="cell.selected || undefined"
              :aria-colindex="cell.col + (valuesOnRows ? 3 : 2)"
              :data-row="index"
              :data-col="cell.col"
              :style="cell.style"
            >
              <span class="dou-pivot__text">{{ cell.text }}</span>
            </div>
          </div>
        </div>
      </div>
      <span ref="measurer" class="dou-pivot__measure" aria-hidden="true" />
      <div
        v-if="result.matched === 0 && !busy && result !== shapeOnly"
        class="dou-pivot__empty"
        role="status"
      >
        {{ messages.noData }}
      </div>
    </div>
    <span class="dou-pivot__live" role="status" aria-live="polite">{{ announcement }}</span>
    <!-- the last result stays under a veil while the next one is summed up -->
    <div v-if="busy" class="dou-pivot__veil" role="status">
      <span class="dou-pivot__busy">{{ messages.busy }}</span>
    </div>
  </div>
</template>
