<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon } from '@dou-ui/icons'
import { matchesHotkey, useElementSize, useLocale, useNow } from 'dou-ui'
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
  useTemplateRef,
  watch,
} from 'vue'
import { ganttKey, type GanttContext } from './context'
import { resolveGanttExtensions } from './core/extension'
import { endKeepingWork, isWorkTime, offTime, resolveCalendar } from './core/calendar'
import { arrowPath, roundedPath, routeLink, type BarBox } from './core/geometry'
import { GanttHistory } from './core/history'
import { linkRefusal, linkTypeOf, type GanttLinkRefusal } from './core/links'
import { createId, spanOf, writeSpan, type GanttLink, type GanttTask } from './core/model'
import { computeCriticalPath, computeSchedule, findBrokenLinks } from './core/schedule'
import {
  GanttTransaction,
  type GanttDocument,
  type GanttStep,
  type GanttTransactionMeta,
} from './core/transaction'
import {
  DAY_WIDTH_RANGE,
  hourStep,
  levelByName,
  levelOf,
  snapStep,
  unitsBetween,
  type GanttScale,
  type TimeUnit,
} from './core/scale'
import { MINUTES_PER_DAY, dayIndex, dayStart, parseTime, wallClockNow } from './core/time'
import { buildTree, type GanttRow } from './core/tree'
import { dateLabel, durationLabel, endLabel, unitLabel } from './labels'
import { format, useGanttMessages } from './locale'
import type {
  GanttColumn,
  GanttEmits,
  GanttExpose,
  GanttMove,
  GanttProps,
  GanttSlots,
} from './types'

defineOptions({ name: 'DouGantt' })

const props = withDefaults(defineProps<GanttProps>(), {
  table: true,
  tableWidth: 360,
  rowHeight: 36,
  barLabel: 'auto',
  today: true,
  scheduling: 'manual',
})
const tasks = defineModel<GanttTask[]>('tasks', { default: () => [] })
const links = defineModel<GanttLink[]>('links', { default: () => [] })
const selection = defineModel<string[]>('selection', { default: () => [] })
const scale = defineModel<GanttScale>('scale')
const emit = defineEmits<GanttEmits>()
defineSlots<GanttSlots>()

const messages = useGanttMessages(() => props.messages)
const resolved = computed(() => resolveGanttExtensions(props.extensions))
const { locale } = useLocale()
const weekStart = computed(() => props.weekStart ?? locale.value.region.weekStart)

/** Height of the two-row time header, in px; the table's header matches it. */
const HEADER = 56
/** Height of a task bar, in px. */
const BAR = 20
/** Room around the visible part that is rendered too, in px. */
const OVERSCAN_X = 320
const OVERSCAN_ROWS = 6
/** Below this width the table steps aside and the timeline takes the whole width. */
const NARROW = 520

const root = useTemplateRef<HTMLElement>('root')
const chart = useTemplateRef<HTMLElement>('chart')
const tableBody = useTemplateRef<HTMLElement>('tableBody')
const { width: rootWidth } = useElementSize(root)
const { width: viewWidth, height: viewHeight } = useElementSize(chart)

// Tasks ---------------------------------------------------------------------------

// Document and history -------------------------------------------------------------

const history = new GanttHistory()
const canUndo = ref(false)
const canRedo = ref(false)
const syncHistory = () => {
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
}
const editable = computed(() => !props.readonly)

/*
 * A bound v-model only catches up when the parent renders, so changes made
 * in the same tick (a drag, then undo) build on the latest commit instead.
 */
let latest: GanttDocument | null = null
const docOf = (): GanttDocument =>
  latest ?? { tasks: toRaw(tasks.value), links: toRaw(links.value) }

function commit(tr: GanttTransaction) {
  if (!latest) void nextTick(() => (latest = null))
  latest = tr.doc
  if (tr.touches('tasks')) tasks.value = tr.doc.tasks
  if (tr.touches('links')) links.value = tr.doc.links
  if (tr.touches('tasks')) {
    const ids = new Set(tr.doc.tasks.map((task) => task.id))
    const kept = selection.value.filter((id) => ids.has(id))
    if (kept.length !== selection.value.length) selection.value = kept
  }
  if (selectedLink.value && !tr.doc.links.some((link) => link.id === selectedLink.value))
    selectedLink.value = null
  emit('transaction', tr)
}

/** Tasks a transaction gave dates to. */
function datedIn(steps: readonly GanttStep[]) {
  const out = new Set<string>()
  for (const step of steps) {
    if (step.type === 'addTask') out.add(step.task.id)
    else if (step.type === 'updateTask' && ('start' in step.patch || 'end' in step.patch))
      out.add(step.id)
  }
  return out
}

/** How many tasks automatic scheduling pushed in each transaction. */
const pushedBy = new WeakMap<GanttTransaction, number>()

/** With automatic scheduling, pushes the tasks that wait on what changed, in the same transaction. */
function pushFollowers(tr: GanttTransaction) {
  if (props.scheduling !== 'auto' || tr.meta.schedule === false) return
  const result = computeSchedule(tr.doc, { calendar: calendar.value, fixed: datedIn(tr.steps) })
  for (const [id, patch] of result.moves) tr.updateTask(id, patch)
  if (result.moves.size) pushedBy.set(tr, result.moves.size)
}

/** Applies changes as one transaction, one undo step. */
function transact(fn: (tr: GanttTransaction) => void, meta?: GanttTransactionMeta) {
  const tr = new GanttTransaction(docOf())
  if (meta) tr.setMeta(meta)
  fn(tr)
  if (!tr.changed) return tr
  pushFollowers(tr)
  const before = selection.value
  commit(tr)
  history.record(tr, before, selection.value)
  syncHistory()
  return tr
}

function travel(direction: 'undo' | 'redo') {
  const result = history[direction](docOf())
  if (!result) return null
  result.tr.setMeta({ origin: direction, history: false, schedule: false })
  commit(result.tr)
  selection.value = result.selection
  syncHistory()
  return result.tr
}

const undo = () => !!travel('undo')
const redo = () => !!travel('redo')

/** Moves tasks so that every link is kept, as one undo step. */
function schedule(options: { pull?: boolean } = {}) {
  const result = computeSchedule(docOf(), { calendar: calendar.value, pull: options.pull })
  if (result.moves.size)
    transact(
      (tr) => {
        for (const [id, patch] of result.moves) tr.updateTask(id, patch)
      },
      { schedule: false },
    )
  return result
}

const selectedLink = ref<string | null>(null)

// While a bar is dragged, the chart shows the tasks as they would be after the drop.
const drag = shallowRef<Drag | null>(null)
const shown = computed(() => {
  if (!drag.value?.started) return tasks.value
  const changes = dragPreview.value
  if (!changes) return tasks.value
  return tasks.value.map((task) => {
    const patch = changes.get(task.id)
    return patch ? { ...task, ...patch } : task
  })
})

const tree = computed(() => buildTree(shown.value))
const rows = computed(() => tree.value.rows)
const calendar = computed(() => resolveCalendar(props.calendar))
const selected = computed(() => new Set(selection.value))
const shownDoc = computed<GanttDocument>(() => ({ tasks: shown.value, links: links.value }))

/** While dragging with automatic scheduling: the tasks the drop would push, and where to. */
const pushPreview = computed(() => {
  const changes = dragPreview.value
  if (props.scheduling !== 'auto' || !changes || drag.value?.mode === 'progress') return null
  return computeSchedule(shownDoc.value, { calendar: calendar.value, fixed: changes.keys() })
})

/** Links whose later task starts (or ends) before the link allows. */
const brokenLinks = computed(
  () => pushPreview.value?.violated ?? findBrokenLinks(shownDoc.value, calendar.value),
)
const critical = computed(() =>
  props.critical ? computeCriticalPath(shownDoc.value, calendar.value) : null,
)

// Time axis -----------------------------------------------------------------------

/** How wide a day is, in px; zooming changes it smoothly. */
const dayWidth = ref(levelByName(scale.value ?? 'day').base)
/** Without a `scale`, the first view picks the day width that fits the tasks. */
let fitPending = scale.value == null
const level = computed(() => levelOf(dayWidth.value))
/** px per minute. */
const ppm = computed(() => dayWidth.value / MINUTES_PER_DAY)

watch(level, (next) => {
  if (scale.value !== next.name) scale.value = next.name
})
// a picked level zooms around now when it is in view, else around the middle
watch(scale, (name) => {
  if (!name || level.value.name === name) return
  const x = todayX.value == null ? null : todayX.value - scrollLeft.value
  zoomTo(levelByName(name).base, x != null && x >= 0 && x <= viewWidth.value ? x : undefined)
})

const nowMs = useNow({ interval: 60_000 })
const now = computed(() => wallClockNow(new Date(nowMs.value)))

/** The time the tasks cover, or the coming month when nothing is scheduled. */
const content = computed(() => {
  let start = Infinity
  let end = -Infinity
  for (const row of tree.value.byId.values()) {
    if (!row.span) continue
    start = Math.min(start, row.span.start)
    end = Math.max(end, row.span.end)
  }
  if (start > end) {
    start = dayStart(now.value)
    end = start + 30 * MINUTES_PER_DAY
  }
  return { start, end }
})

/** Minutes added at either end by scrolling close to it. */
const grown = ref({ before: 0, after: 0 })

/** The span the timeline covers. */
const extent = computed(() => {
  const fixed = props.range?.map((text) => parseTime(text))
  if (fixed?.[0] && fixed[1])
    return { start: dayStart(fixed[0].at), end: dayStart(fixed[1].at) + MINUTES_PER_DAY }
  const pad = Math.max((viewWidth.value || 800) / ppm.value, 7 * MINUTES_PER_DAY)
  return {
    start: dayStart(content.value.start - pad - grown.value.before),
    end: dayStart(content.value.end + pad + grown.value.after) + MINUTES_PER_DAY,
  }
})
const origin = computed(() => extent.value.start)
const totalWidth = computed(() => Math.ceil((extent.value.end - extent.value.start) * ppm.value))
const xOf = (at: number) => (at - origin.value) * ppm.value

// Scrolling -----------------------------------------------------------------------

const scrollTop = ref(0)
const scrollLeft = ref(0)
/**
 * The time at the left edge of the view. It is what stays put: when the
 * extent grows or the zoom changes, the scroll position follows it.
 */
const viewStart = ref(0)
const scrollbar = ref(0)

function onChartScroll() {
  const el = chart.value!
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
  viewStart.value = origin.value + el.scrollLeft / ppm.value
  if (tableBody.value && Math.abs(tableBody.value.scrollTop - el.scrollTop) >= 1)
    tableBody.value.scrollTop = el.scrollTop
  if (props.range) return
  const view = viewWidth.value / ppm.value
  if (el.scrollLeft < viewWidth.value / 2)
    grown.value = { ...grown.value, before: grown.value.before + 2 * view }
  else if (el.scrollLeft + viewWidth.value > totalWidth.value - viewWidth.value / 2)
    grown.value = { ...grown.value, after: grown.value.after + 2 * view }
}

function onTableScroll() {
  const body = tableBody.value!
  if (chart.value && Math.abs(chart.value.scrollTop - body.scrollTop) >= 1)
    chart.value.scrollTop = body.scrollTop
}

// keep the time at the left edge in place as the axis changes under it
watch(
  [origin, ppm, totalWidth],
  () => {
    const el = chart.value
    if (!el) return
    const target = Math.round((viewStart.value - origin.value) * ppm.value)
    if (Math.abs(el.scrollLeft - target) >= 1) el.scrollLeft = target
    scrollLeft.value = el.scrollLeft
  },
  { flush: 'post' },
)

function measureScrollbar() {
  const el = chart.value
  if (el) scrollbar.value = el.offsetHeight - el.clientHeight
}
watch([viewHeight, viewWidth], measureScrollbar, { flush: 'post' })

function scrollToTime(at: number, offset = 48) {
  viewStart.value = at - offset / ppm.value
  const el = chart.value
  if (!el) return
  el.scrollLeft = Math.round((viewStart.value - origin.value) * ppm.value)
  scrollLeft.value = el.scrollLeft
}

/** The widest a day gets when fitting, so short plans don't zoom to hours. */
const FIT_MAX = 64

function fit() {
  // worked out from the root, so a table about to step aside doesn't count
  const width = showTable.value ? viewWidth.value : rootWidth.value
  if (!width) return
  const days = Math.max(1, (content.value.end - content.value.start) / MINUTES_PER_DAY)
  dayWidth.value = Math.min(FIT_MAX, Math.max(DAY_WIDTH_RANGE[0], (width - 96) / days))
  scrollToTime(content.value.start)
}

onMounted(() => {
  measureScrollbar()
  scrollToTime(content.value.start)
})

watch([rootWidth, viewWidth], ([outer, inner]) => {
  if (!fitPending || !outer || !inner) return
  fitPending = false
  fit()
})

// Dates that can't be read leave a task unscheduled; say so once per task while developing.
const warned = new Set<string>()
watch(
  tasks,
  (list) => {
    // the app's bundler replaces this, as for Vue's own warnings
    if (process.env.NODE_ENV === 'production') return
    for (const task of list) {
      for (const key of ['start', 'end'] as const) {
        const text = task[key]
        if (text == null || text === '' || parseTime(text) || warned.has(`${task.id}:${key}`))
          continue
        warned.add(`${task.id}:${key}`)
        console.warn(
          `[@dou-ui/gantt] task "${task.id}" has a ${key} that can't be read: "${text}". Use YYYY-MM-DD or YYYY-MM-DD HH:mm.`,
        )
      }
    }
  },
  { immediate: true },
)

// Zoom ----------------------------------------------------------------------------

/** Changes the day width, keeping the time under `anchor` (px from the view's left) in place. */
function zoomTo(width: number, anchor = viewWidth.value / 2) {
  const next = Math.min(DAY_WIDTH_RANGE[1], Math.max(DAY_WIDTH_RANGE[0], width))
  const at = viewStart.value + anchor / ppm.value
  dayWidth.value = next
  viewStart.value = at - anchor / ppm.value
}

function onWheel(event: WheelEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  event.preventDefault()
  const rect = chart.value!.getBoundingClientRect()
  zoomTo(dayWidth.value * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left)
}

const ZOOM_STEP = 1.5
const zoomIn = () => zoomTo(dayWidth.value * ZOOM_STEP)
const zoomOut = () => zoomTo(dayWidth.value / ZOOM_STEP)

// What is in view -----------------------------------------------------------------

const bodyHeight = computed(() => Math.max(0, viewHeight.value - HEADER))
const rowWindow = computed(() => {
  const h = props.rowHeight
  const from = Math.max(0, Math.floor(scrollTop.value / h) - OVERSCAN_ROWS)
  const to = Math.min(
    rows.value.length,
    Math.ceil((scrollTop.value + bodyHeight.value) / h) + OVERSCAN_ROWS,
  )
  return { from, to }
})
const visibleRows = computed(() => rows.value.slice(rowWindow.value.from, rowWindow.value.to))

/** The time in view, with some room either side. */
const timeWindow = computed(() => ({
  start: origin.value + (scrollLeft.value - OVERSCAN_X) / ppm.value,
  end: origin.value + (scrollLeft.value + (viewWidth.value || 800) + OVERSCAN_X) / ppm.value,
}))

// Header ---------------------------------------------------------------------------

interface HeaderCell {
  key: number
  end: number
  left: number
  width: number
  label: string
}

function cells(unit: TimeUnit, step = 1): HeaderCell[] {
  const { start, end } = timeWindow.value
  return unitsBetween(unit, Math.max(start, origin.value), end, weekStart.value, step).map(
    (cell) => ({
      key: cell.start,
      end: cell.end,
      left: xOf(cell.start),
      width: (cell.end - cell.start) * ppm.value,
      label: unitLabel(unit, cell.start, messages.value, dayWidth.value),
    }),
  )
}

const headerStep = computed(() => (level.value.bottom === 'hour' ? hourStep(dayWidth.value) : 1))
const topCells = computed(() => cells(level.value.top))
const bottomCells = computed(() => cells(level.value.bottom, headerStep.value))

/** Days off, shaded; at hour level the hours outside work too. */
const shaded = computed(() => {
  if (dayWidth.value < 8) return []
  const { start, end } = timeWindow.value
  return offTime(calendar.value, start, end, level.value.name === 'hour').map((range) => ({
    key: range.start,
    left: xOf(range.start),
    width: (range.end - range.start) * ppm.value,
  }))
})

/**
 * Without the table, rows whose bar is out of view (or that have none)
 * show their title at the left edge of the timeline.
 */
const rowTitles = computed(() => {
  if (showTable.value) return []
  const from = origin.value + scrollLeft.value / ppm.value
  const to = origin.value + (scrollLeft.value + viewWidth.value) / ppm.value
  return visibleRows.value
    .filter((row) => !row.span || row.span.end < from || row.span.start > to)
    .map((row) => ({ row }))
})

/**
 * Tasks with a link at their finishing end. Their side titles step further
 * out, past where the line leaves or arrives, so the two don't run together.
 */
const linkedEnds = computed(() => {
  const out = new Set<string>()
  for (const link of links.value) {
    const type = link.type ?? 'fs'
    if (type === 'fs' || type === 'ff') out.add(link.from)
    if (type === 'ff' || type === 'sf') out.add(link.to)
  }
  return out
})

/** Where a bar's side title starts, from the bar's left. */
const sideOffset = (bar: Bar) =>
  (bar.row.milestone ? 12 : bar.width + 8) + (linkedEnds.value.has(bar.row.task.id) ? 10 : 0)

/** Rows titled at the edge; their own side labels would only crowd it. */
const titled = computed(() => new Set(rowTitles.value.map((item) => item.row.task.id)))

const todayX = computed(() =>
  props.today && now.value >= extent.value.start && now.value <= extent.value.end
    ? xOf(now.value)
    : null,
)

// Bars ------------------------------------------------------------------------------

let canvas: CanvasRenderingContext2D | null | undefined
/** Width of a bar title in px; estimated where text can't be measured. */
function textWidth(text: string) {
  // measure only once the chart is in the page and its font is known
  if (canvas === undefined && root.value) {
    try {
      canvas = document.createElement('canvas').getContext('2d')
      if (canvas) {
        const style = getComputedStyle(root.value)
        canvas.font = `${style.getPropertyValue('--dou-font-size-sm').trim() || '13px'} ${style.fontFamily}`
      }
    } catch {
      canvas = null
    }
  }
  return canvas ? canvas.measureText(text).width : text.length * 13
}

interface Bar {
  row: GanttRow
  left: number
  width: number
  top: number
  /** Where the title goes. */
  label: 'inside' | 'outside' | 'none'
  aria: string
}

function describe(row: GanttRow) {
  const m = messages.value
  const { task, span } = row
  if (!span) return format(m.unscheduled, { title: task.title })
  const start = dateLabel(span.start, span.dateOnly, m)
  if (row.milestone) return format(m.milestone, { title: task.title, start })
  const params = {
    title: task.title,
    start,
    end: endLabel(span, m),
    duration: durationLabel(span, calendar.value, m),
    progress: Math.round(row.progress * 100),
  }
  const text = format(row.summary ? m.summary : m.task, params)
  return critical.value?.tasks.has(task.id) ? format(m.criticalTask, { task: text }) : text
}

const bars = computed<Bar[]>(() => {
  const { start, end } = timeWindow.value
  const h = props.rowHeight
  const out: Bar[] = []
  for (const row of visibleRows.value) {
    const span = row.span
    if (!span || span.end < start - 600 / ppm.value || span.start > end) continue
    const left = xOf(span.start)
    const width = Math.max(row.milestone ? 0 : 2, (span.end - span.start) * ppm.value)
    let label: Bar['label'] = props.barLabel === 'auto' ? 'inside' : props.barLabel
    if (row.milestone || row.summary) label = props.barLabel === 'none' ? 'none' : 'outside'
    else if (props.barLabel === 'auto' && textWidth(row.task.title) + 20 > width) label = 'outside'
    out.push({ row, left, width, top: row.index * h, label, aria: describe(row) })
  }
  return out
})

/** Dashed outlines where a drag would push the waiting tasks to. */
const ghosts = computed(() => {
  const moves = pushPreview.value?.moves
  if (!moves?.size) return []
  const out: { id: string; left: number; width: number; top: number; milestone: boolean }[] = []
  for (const [id, patch] of moves) {
    const row = tree.value.byId.get(id)
    const span = row && row.index >= 0 && spanOf({ ...row.task, ...patch })
    if (!span) continue
    out.push({
      id,
      left: xOf(span.start),
      width: Math.max(2, (span.end - span.start) * ppm.value),
      top: row.index * props.rowHeight,
      milestone: row.milestone,
    })
  }
  return out
})

// Links -----------------------------------------------------------------------------

/** Half the width of a milestone's diamond, where lines meet it. */
const MILESTONE = 7

function boxOf(row: GanttRow): BarBox | null {
  if (!row.span || row.index < 0) return null
  const y = row.index * props.rowHeight + props.rowHeight / 2
  if (row.milestone) {
    const x = xOf(row.span.start)
    return { left: x - MILESTONE, right: x + MILESTONE, y }
  }
  const left = xOf(row.span.start)
  return { left, right: left + Math.max(2, (row.span.end - row.span.start) * ppm.value), y }
}

const linkPaths = computed(() => {
  if (dayWidth.value < 1) return []
  const { from, to } = rowWindow.value
  const xFrom = scrollLeft.value - OVERSCAN_X
  const xTo = scrollLeft.value + (viewWidth.value || 800) + OVERSCAN_X
  const out: { link: GanttLink; d: string; arrow: string }[] = []
  for (const link of links.value) {
    const a = tree.value.byId.get(link.from)
    const b = tree.value.byId.get(link.to)
    if (!a || !b || a === b) continue
    if (Math.max(a.index, b.index) < from || Math.min(a.index, b.index) >= to) continue
    const boxA = boxOf(a)
    const boxB = boxOf(b)
    if (!boxA || !boxB) continue
    if (Math.max(boxA.right, boxB.right) + 24 < xFrom || Math.min(boxA.left, boxB.left) - 24 > xTo)
      continue
    const route = routeLink(boxA, boxB, link.type, props.rowHeight)
    out.push({
      link,
      d: roundedPath(route.points),
      arrow: arrowPath(route.tip, route.direction),
    })
  }
  return out
})

// Table ------------------------------------------------------------------------------

const narrow = computed(() => rootWidth.value > 0 && rootWidth.value < NARROW)
const showTable = computed(() => props.table && !narrow.value)
/** The narrowest the table gets, in px. */
const TABLE_MIN = 160
const tableSize = ref(props.tableWidth)
/** The table leaves the timeline at least 40% of the width. */
const tableMax = computed(() => Math.max(TABLE_MIN, Math.round((rootWidth.value || 1000) * 0.6)))
const clampTable = (size: number) => Math.min(tableMax.value, Math.max(TABLE_MIN, size))
watch(tableMax, () => (tableSize.value = clampTable(tableSize.value)))

function onDividerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture(event.pointerId)
  const from = event.clientX
  const size = tableSize.value
  const move = (e: PointerEvent) => (tableSize.value = clampTable(size + e.clientX - from))
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

function onDividerKey(event: KeyboardEvent) {
  const by = event.shiftKey ? 80 : 16
  if (event.key === 'ArrowLeft') tableSize.value = clampTable(tableSize.value - by)
  else if (event.key === 'ArrowRight') tableSize.value = clampTable(tableSize.value + by)
  else return
  event.preventDefault()
}

const columns = computed<GanttColumn[]>(() => [
  ...(props.columns ?? [
    { key: 'title' },
    { key: 'start', width: 96 },
    { key: 'duration', width: 72 },
  ]),
  ...resolved.value.columns,
])

/** Columns without a width in px are counted at this, or at their `minWidth`. */
const FLEX_COLUMN = 64
const TITLE_MIN = 120

/** A length in px, when it is one. */
const px = (value: number | string | undefined) =>
  typeof value === 'number' ? value : value?.endsWith('px') ? Number.parseFloat(value) : null

/** The narrowest the columns go; past it the table scrolls sideways. */
const tableMinWidth = computed(() => {
  let total = 0
  for (const column of columns.value)
    total +=
      px(column.width) ?? px(column.minWidth) ?? (column.key === 'title' ? TITLE_MIN : FLEX_COLUMN)
  return total
})

const tablePane = useTemplateRef<HTMLElement>('tablePane')
/** Height of the table's own sideways scrollbar, in px. */
const tableScrollbar = ref(0)
watch(
  [tableSize, tableMinWidth, viewHeight, showTable],
  () => {
    const el = tablePane.value
    tableScrollbar.value = el ? el.offsetHeight - el.clientHeight : 0
  },
  { flush: 'post' },
)

function headerOf(column: GanttColumn) {
  if (column.title != null) return column.title
  const builtIn = messages.value.columns as Record<string, string>
  return builtIn[column.key] ?? column.key
}

function cellText(row: GanttRow, column: GanttColumn) {
  if (column.value) {
    const value = column.value(row.task)
    return value == null ? '' : String(value)
  }
  const m = messages.value
  const span = row.span
  switch (column.key) {
    case 'title':
      return row.task.title
    case 'start':
      return span
        ? dateLabel(
            span.start - (row.milestone && span.dateOnly ? MINUTES_PER_DAY / 2 : 0),
            span.dateOnly,
            m,
          )
        : ''
    case 'end':
      return span && !row.milestone ? endLabel(span, m) : ''
    case 'duration':
      return span && !row.milestone ? durationLabel(span, calendar.value, m) : ''
    case 'progress':
      return span && !row.milestone ? `${Math.round(row.progress * 100)}%` : ''
    default: {
      const value = row.task.data?.[column.key]
      return value == null ? '' : String(value)
    }
  }
}

const cssLength = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value

function columnStyle(column: GanttColumn) {
  const width = cssLength(column.width)
  return {
    flex: width ? `0 0 ${width}` : '1 1 0',
    width,
    minWidth: cssLength(column.minWidth),
  }
}

// folding is a view change: it stays out of the undo history
function toggle(row: GanttRow) {
  transact((tr) => tr.updateTask(row.task.id, { collapsed: !row.task.collapsed || undefined }), {
    history: false,
  })
}

// Selection and events ------------------------------------------------------------

const hovered = ref<string | null>(null)

function select(task: GanttTask, event: MouseEvent) {
  const id = task.id
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    selection.value = selected.value.has(id)
      ? selection.value.filter((item) => item !== id)
      : [...selection.value, id]
  } else if (selection.value.length !== 1 || selection.value[0] !== id) {
    selection.value = [id]
  }
}

function onTaskClick(row: GanttRow, event: MouseEvent) {
  if (dragged) return
  selectedLink.value = null
  active.value = row.task.id
  select(row.task, event)
  emit('taskClick', row.task, event)
}

const highlightRows = computed(() =>
  visibleRows.value.filter(
    (row) => selected.value.has(row.task.id) || hovered.value === row.task.id,
  ),
)

// Dragging ---------------------------------------------------------------------------

type DragMode = 'move' | 'start' | 'end' | 'progress' | 'link' | 'draw'
type End = 'start' | 'end'

interface Drag {
  mode: DragMode
  /** The task pressed. */
  id: string
  pointerId: number
  touch: boolean
  /** Where the press was, in timeline px. */
  x0: number
  /** Where the pointer is now, in timeline px and on screen. */
  x: number
  clientX: number
  clientY: number
  /** Past the threshold: a drag, not a click. */
  started: boolean
  /** The tasks that move, with their spans when the drag began. */
  spans: Map<string, { start: number; end: number; dateOnly: boolean }>
  /** For `progress`: the bar's box when the drag began. */
  box?: { left: number; width: number }
  /** For `link`: the end it starts from, and what is under the pointer. */
  from?: End
  target?: { id: string; end: End; refusal: GanttLinkRefusal | null; reason?: string }
  /** For `draw`: the row's y centre. */
  y?: number
}

/** Movement in px before a press becomes a drag. */
const THRESHOLD = { mouse: 3, touch: 6 }
/** How long a finger rests on a bar before it picks it up, in ms. */
const LONG_PRESS = 300
/** How close to the edge a drag starts scrolling, in px. */
const EDGE = 32

/** The last drag ended a moment ago: swallow the click that follows it. */
let dragged = false
let pressTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0

/** The step a drag snaps to for these spans: whole days when any is date-only. */
function stepFor(spans: Iterable<{ dateOnly: boolean }>) {
  const step = snapStep(dayWidth.value)
  for (const span of spans) if (span.dateOnly) return Math.max(step, MINUTES_PER_DAY)
  return step
}

const snap = (at: number, step: number) => Math.round(at / step) * step
const task = (id: string) => tasks.value.find((item) => item.id === id)!
/** Auto-scroll speed in px per frame, `gap` px from the edge. */
const edgeSpeed = (gap: number) => (gap < EDGE ? Math.ceil(((EDGE - gap) / EDGE) * 16) : 0)

/** The changes the current drag would make, by task id. */
const dragPreview = computed<Map<string, Partial<GanttTask>> | null>(() => {
  const d = drag.value
  if (!d?.started) return null
  const out = new Map<string, Partial<GanttTask>>()
  const delta = (d.x - d.x0) / ppm.value
  switch (d.mode) {
    case 'move': {
      const unit = stepFor(d.spans.values())
      const first = d.spans.get(d.id) ?? d.spans.values().next().value!
      const shift = snap(first.start + delta, unit) - first.start
      // the work stays the same: moving across a weekend stretches the bar
      for (const [id, span] of d.spans) {
        const start = span.start + shift
        out.set(id, writeSpan(task(id), start, endKeepingWork(calendar.value, span, start)))
      }
      break
    }
    case 'start':
    case 'end': {
      const span = d.spans.get(d.id)!
      const unit = stepFor([span])
      if (d.mode === 'start') {
        const start = Math.min(snap(span.start + delta, unit), span.end - unit)
        out.set(d.id, writeSpan(task(d.id), start, span.end))
      } else {
        const end = Math.max(snap(span.end + delta, unit), span.start + unit)
        out.set(d.id, writeSpan(task(d.id), span.start, end))
      }
      break
    }
    case 'progress': {
      const { left, width } = d.box!
      const value = Math.round(Math.min(1, Math.max(0, (d.x - left) / width)) * 20) / 20
      out.set(d.id, { progress: value })
      break
    }
    case 'draw': {
      const unit = Math.max(snapStep(dayWidth.value), MINUTES_PER_DAY)
      const a = origin.value + Math.min(d.x0, d.x) / ppm.value
      const b = origin.value + Math.max(d.x0, d.x) / ppm.value
      const start = Math.floor(a / unit) * unit
      const end = Math.max(start + unit, Math.ceil(b / unit) * unit)
      out.set(d.id, writeSpan(task(d.id), start, end))
      break
    }
    case 'link':
      return null
  }
  return out
})

const contentX = (clientX: number) =>
  clientX - chart.value!.getBoundingClientRect().left + chart.value!.scrollLeft

/** The leaf tasks a drag on `row` moves: the row itself, its subtasks, or the whole selection. */
function movers(row: GanttRow) {
  const out = new Map<string, { start: number; end: number; dateOnly: boolean }>()
  const add = (id: string) => {
    const item = tree.value.byId.get(id)
    if (!item || item.task.locked) return
    if (item.summary) {
      for (const child of tree.value.childrenOf.get(id) ?? []) add(child.id)
    } else if (item.span) out.set(id, { ...item.span })
  }
  const ids = selected.value.has(row.task.id) ? selection.value : [row.task.id]
  for (const id of ids) add(id)
  return out
}

function startDrag(event: PointerEvent, row: GanttRow, mode: DragMode, from?: End) {
  if (event.button !== 0 || !editable.value) return
  const touch = event.pointerType === 'touch'
  const x = contentX(event.clientX)
  const d: Drag = {
    mode,
    id: row.task.id,
    pointerId: event.pointerId,
    touch,
    x0: x,
    x,
    clientX: event.clientX,
    clientY: event.clientY,
    started: false,
    spans: new Map(),
    from,
  }
  if (mode === 'move') {
    d.spans = movers(row)
    if (!d.spans.size) return
  } else if (mode === 'start' || mode === 'end') {
    if (!row.span || row.task.locked) return
    d.spans.set(row.task.id, { ...row.span })
  } else if (mode === 'progress') {
    if (!row.span || row.task.locked) return
    d.box = {
      left: xOf(row.span.start),
      width: Math.max(1, (row.span.end - row.span.start) * ppm.value),
    }
  }
  drag.value = d
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragCancel)
  window.addEventListener('keydown', onDragKey, true)
  // a finger picks a bar up after a short rest; moving sooner scrolls instead
  if (touch && mode === 'move') {
    pressTimer = setTimeout(() => {
      if (drag.value !== d) return
      begin(d)
      navigator.vibrate?.(8)
    }, LONG_PRESS)
  }
}

function begin(d: Drag) {
  d.started = true
  window.addEventListener('touchmove', preventScroll, { passive: false })
  frame = requestAnimationFrame(autoScroll)
  drag.value = { ...d }
}

const preventScroll = (event: TouchEvent) => event.preventDefault()

function onDragMove(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  d.clientX = event.clientX
  d.clientY = event.clientY
  const x = contentX(event.clientX)
  if (!d.started) {
    const far = Math.abs(x - d.x0) > THRESHOLD[d.touch ? 'touch' : 'mouse']
    if (!far) return
    // a finger that moves before the long press scrolls the chart
    if (d.touch && d.mode === 'move') return stopDrag()
    begin(d)
  }
  update(drag.value!, x)
}

function update(d: Drag, x: number) {
  const next = { ...d, x }
  if (d.mode === 'link') next.target = linkTarget(d)
  drag.value = next
}

let canLinkWarned = false
// a `canLink` that forgets its last `return true` refuses every link
function warnCanLink() {
  if (process.env.NODE_ENV === 'production' || canLinkWarned) return
  canLinkWarned = true
  console.warn(
    '[DouGantt] canLink returned undefined, so the link is refused. Return true to allow it.',
  )
}

/** The bar end under the pointer, and whether a link to it would be refused. */
function linkTarget(d: Drag): Drag['target'] {
  // look through lines and handles to the bar underneath
  const el = document
    .elementsFromPoint(d.clientX, d.clientY)
    .find((item): item is HTMLElement => item instanceof HTMLElement && !!item.dataset.task)
  const id = el?.dataset.task
  if (!el || !id) return undefined
  const rect = el.getBoundingClientRect()
  const end: End = d.clientX < rect.left + rect.width / 2 ? 'start' : 'end'
  return { id, end, ...checkLink(d.id, id, linkTypeOf(d.from!, end)) }
}

/** Whether a link may be made, and if not, why: the built-in rules, then `can-link` and the extensions'. */
function checkLink(from: string, to: string, type: GanttLink['type']) {
  let refusal = linkRefusal(new Map(tasks.value.map((t) => [t.id, t])), links.value, from, to)
  let reason: string | undefined
  if (refusal && refusal !== 'self' && refusal !== 'custom')
    reason = messages.value.linkRefusals[refusal]
  if (refusal) return { refusal, reason }
  const link = { from, to, type }
  for (const rule of [...(props.canLink ? [props.canLink] : []), ...resolved.value.linkRules]) {
    const answer = rule(link, docOf())
    if (answer === true) continue
    if (answer === undefined) warnCanLink()
    return {
      refusal: 'custom' as const,
      reason: typeof answer === 'string' && answer ? answer : undefined,
    }
  }
  return { refusal: null, reason }
}

/**
 * Why new dates can't be written, from `can-move` and the extensions'; a
 * refusal without words gets a plain one. `null` when they can.
 */
function checkMove(changes: Map<string, Partial<GanttTask>>) {
  const rules = [...(props.canMove ? [props.canMove] : []), ...resolved.value.moveRules]
  if (!rules.length) return null
  const doc = docOf()
  for (const [id, patch] of changes) {
    if (patch.start === undefined) continue
    const move: GanttMove = { task: task(id), start: patch.start, end: patch.end }
    for (const rule of rules) {
      const answer = rule(move, doc)
      if (answer === true) continue
      return typeof answer === 'string' && answer ? answer : messages.value.moveRefused
    }
  }
  return null
}

/** Why the current drag's dates would be refused, its own or those of the tasks it pushes. */
const dragRefusal = computed(() => {
  const changes = dragPreview.value
  if (!changes || drag.value?.mode === 'progress') return null
  const pushes = pushPreview.value?.moves
  return checkMove(pushes?.size ? new Map([...changes, ...pushes]) : changes)
})

// scroll while the pointer rests near an edge, and keep the drag under it
function autoScroll() {
  const d = drag.value
  const el = chart.value
  if (!d?.started || !el) return
  const rect = el.getBoundingClientRect()
  const dx = -edgeSpeed(d.clientX - rect.left) || edgeSpeed(rect.right - d.clientX)
  const dy = -edgeSpeed(d.clientY - rect.top - HEADER) || edgeSpeed(rect.bottom - d.clientY)
  if (dx || (dy && d.mode === 'link')) {
    el.scrollLeft += dx
    if (d.mode === 'link') el.scrollTop += dy
    update(d, contentX(d.clientX))
  }
  frame = requestAnimationFrame(autoScroll)
}

function onDragEnd(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  if (d.started) {
    dragged = true
    setTimeout(() => (dragged = false))
    if (d.mode === 'link') finishLink(d)
    else if (dragRefusal.value) announce(dragRefusal.value)
    else {
      const changes = dragPreview.value
      if (changes) {
        const done = transact((tr) => {
          for (const [id, patch] of changes) tr.updateTask(id, patch)
        })
        announceTask(d.id, done)
      }
    }
  }
  stopDrag()
}

function finishLink(d: Drag) {
  const target = d.target
  if (!target || target.refusal) return
  const link: GanttLink = { id: createId(), from: d.id, to: target.id }
  const type = linkTypeOf(d.from!, target.end)
  if (type !== 'fs') link.type = type
  const done = transact((tr) => tr.addLink(link))
  emit('link', link)
  announceLinked(link, done)
}

function announceLinked(link: GanttLink, tr: GanttTransaction) {
  const m = messages.value
  announce(
    withPushed(format(m.linked, { from: task(link.from).title, to: task(link.to).title }), tr),
  )
}

/** Adds how many tasks automatic scheduling pushed, if any. */
function withPushed(text: string, tr: GanttTransaction) {
  const count = pushedBy.get(tr)
  return count ? format(messages.value.pushed, { task: text, count }) : text
}

const onDragCancel = () => stopDrag()

function onDragKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !drag.value) return
  event.preventDefault()
  event.stopPropagation()
  if (drag.value.started) {
    dragged = true
    setTimeout(() => (dragged = false))
  }
  stopDrag()
}

function stopDrag() {
  clearTimeout(pressTimer)
  cancelAnimationFrame(frame)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragCancel)
  window.removeEventListener('keydown', onDragKey, true)
  window.removeEventListener('touchmove', preventScroll)
  drag.value = null
}

onBeforeUnmount(stopDrag)

function onBarDown(event: PointerEvent, row: GanttRow) {
  const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset
    .handle as DragMode | `link-${End}` | undefined
  if (handle?.startsWith('link-')) {
    event.stopPropagation()
    return startDrag(event, row, 'link', handle.slice(5) as End)
  }
  if (handle) event.stopPropagation()
  startDrag(event, row, (handle as DragMode) ?? 'move')
}

/** A press on an empty row of a task without dates draws its dates. */
function onBodyDown(event: PointerEvent) {
  if (
    event.target !== event.currentTarget &&
    !(event.target as HTMLElement).matches(
      '.dou-gantt__off, .dou-gantt__gridline, .dou-gantt__row-highlight',
    )
  )
    return
  const y =
    event.clientY - chart.value!.getBoundingClientRect().top - HEADER + chart.value!.scrollTop
  const row = rows.value[Math.floor(y / props.rowHeight)]
  if (!row || row.span || row.summary || row.task.locked) return
  if (event.pointerType === 'touch') return
  startDrag(event, row, 'draw')
}

/** The bar a link being drawn would end at, and whether it is refused. */
const linkHighlight = computed(() => {
  const target = drag.value?.target
  if (target) return { id: target.id, refused: !!target.refusal }
  const link = keyLink.value
  return link?.to ? { id: link.to, refused: !!link.refusal } : null
})

/** The line drawn while linking: from the end it started at to the pointer or target. */
const draftLink = computed(() => {
  const link = keyLink.value
  if (link?.to) {
    const a = tree.value.byId.get(link.from)
    const b = tree.value.byId.get(link.to)
    const boxA = a && boxOf(a)
    const boxB = b && boxOf(b)
    if (!boxA || !boxB) return null
    return {
      d: roundedPath(routeLink(boxA, boxB, 'fs', props.rowHeight).points),
      refused: !!link.refusal,
    }
  }
  const d = drag.value
  if (d?.mode !== 'link' || !d.started) return null
  const row = tree.value.byId.get(d.id)
  const box = row && boxOf(row)
  if (!box) return null
  const x = d.from === 'start' ? box.left : box.right
  const rect = chart.value!.getBoundingClientRect()
  const y = d.clientY - rect.top - HEADER + chart.value!.scrollTop
  return {
    d: `M${x} ${box.y} L${d.x} ${y}`,
    refused: !!d.target?.refusal,
  }
})

/** Keeps a tip inside the view: one that starts left of it, or runs past its right edge. */
function tipLeft(x: number, text: string) {
  const right = scrollLeft.value + viewWidth.value - textWidth(text) - 24
  return Math.max(Math.min(x, right), scrollLeft.value + 8)
}

/** What a drag shows beside the pointer: new dates, the progress, or why it can't. */
const dragTip = computed(() => {
  const d = drag.value
  if (!d?.started) return null
  if (d.mode === 'link') {
    // say why the bar under the pointer can't take the link
    const target = d.target?.reason ? tree.value.byId.get(d.target.id) : undefined
    if (!target?.span || target.index < 0) return null
    return {
      text: d.target!.reason!,
      refused: true,
      left: tipLeft(xOf(target.span.start), d.target!.reason!),
      top: target.index * props.rowHeight,
    }
  }
  const row = tree.value.byId.get(d.id)
  if (!row?.span || row.index < 0) return null
  const m = messages.value
  const text = dragRefusal.value
    ? dragRefusal.value
    : d.mode === 'progress'
      ? format(m.progressTip, { value: Math.round(row.progress * 100) })
      : row.milestone
        ? dateLabel(
            row.span.start - (row.span.dateOnly ? MINUTES_PER_DAY / 2 : 0),
            row.span.dateOnly,
            m,
          )
        : format(m.rangeTip, {
            start: dateLabel(row.span.start, row.span.dateOnly, m),
            end: endLabel(row.span, m),
            duration: durationLabel(row.span, calendar.value, m),
          })
  return {
    text,
    refused: !!dragRefusal.value,
    left: tipLeft(xOf(row.span.start), text),
    top: row.index * props.rowHeight,
  }
})

// Keys ----------------------------------------------------------------------------------

/** The task the keyboard is on. */
const active = ref<string | null>(null)

/** Puts the keyboard on a task: scrolls it into view and focuses its bar, or its table row. */
function focusTask(id: string) {
  if (!tree.value.byId.get(id)) return
  active.value = id
  scrollToTask(id)
  void nextTick(() => {
    const el =
      root.value?.querySelector<HTMLElement>(`.dou-gantt__bar[data-task="${CSS.escape(id)}"]`) ??
      root.value?.querySelector<HTMLElement>(`.dou-gantt__tr[data-row="${CSS.escape(id)}"]`)
    ;(el ?? root.value)?.focus({ preventScroll: true })
  })
}

/** Reads a task out as it is once the change has reached the rows. */
function announceTask(id: string, tr?: GanttTransaction) {
  void nextTick(() => {
    const row = tree.value.byId.get(id)
    if (row) announce(tr ? withPushed(describe(row), tr) : describe(row))
  })
}

/** Moves the task the keyboard is on (or the selection) by a step, or its end. */
function keyMove(direction: 1 | -1, which: 'move' | 'end') {
  const row = active.value ? tree.value.byId.get(active.value) : undefined
  if (!row || !editable.value) return
  let changes = new Map<string, Partial<GanttTask>>()
  if (which === 'move') {
    const spans = movers(row)
    if (!spans.size) return
    const unit = stepFor(spans.values()) * direction
    // step over time off, so a task doesn't start on a weekend
    const first = spans.get(row.task.id) ?? spans.values().next().value!
    let shift = unit
    for (
      let i = 0;
      i < 366 && !isWorkTime(calendar.value, first.start + shift, first.dateOnly);
      i++
    )
      shift += unit
    for (const [id, span] of spans) {
      const start = span.start + shift
      changes.set(id, writeSpan(task(id), start, endKeepingWork(calendar.value, span, start)))
    }
  } else {
    const span = row.span
    if (!span || row.summary || row.milestone || row.task.locked) return
    const unit = stepFor([span])
    let end = span.end + unit * direction
    // a whole-day task doesn't end on a day off
    while (span.dateOnly && end > span.start + unit && !calendar.value.isWorkday(dayIndex(end - 1)))
      end += unit * direction
    end = Math.max(end, span.start + unit)
    if (end === span.end) return
    changes = new Map([[row.task.id, writeSpan(row.task, span.start, end)]])
  }
  const refusal = checkMove(changes)
  if (refusal) return announce(refusal)
  // repeated presses undo as one step
  const done = transact(
    (tr) => {
      for (const [id, patch] of changes) tr.updateTask(id, patch)
    },
    { group: `keys:${which}:${row.task.id}` },
  )
  scrollToTask(row.task.id)
  announceTask(row.task.id, done)
}

/** Linking by keys: from the task the keyboard was on, to the one picked with Up and Down. */
const keyLink = ref<{
  from: string
  to: string | null
  refusal: GanttLinkRefusal | null
  reason?: string
} | null>(null)

function pickLinkTarget(step: 1 | -1) {
  const link = keyLink.value!
  const list = rows.value
  let index = list.findIndex((row) => row.task.id === (link.to ?? link.from))
  for (let i = 0; i < list.length; i++) {
    index = (index + step + list.length) % list.length
    const row = list[index]!
    if (row.task.id !== link.from && row.span) break
  }
  const to = list[index]!.task.id
  if (to === link.from) return
  keyLink.value = { from: link.from, to, ...checkLink(link.from, to, 'fs') }
  scrollToTask(to)
  const title = task(to).title
  announce(keyLink.value.reason ? `${title}，${keyLink.value.reason}` : title)
}

function onKeyLink(event: KeyboardEvent) {
  const link = keyLink.value!
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    pickLinkTarget(event.key === 'ArrowDown' ? 1 : -1)
  else if (event.key === 'Enter') {
    if (!link.to) return
    if (link.refusal) {
      announce(link.reason ?? messages.value.linkRefusals.cycle)
    } else {
      const made: GanttLink = { id: createId(), from: link.from, to: link.to }
      const done = transact((tr) => tr.addLink(made))
      emit('link', made)
      announceLinked(made, done)
      keyLink.value = null
    }
  } else if (event.key === 'Escape') {
    keyLink.value = null
    announce(messages.value.cancelled)
  } else if (event.key !== 'Tab') return
  event.preventDefault()
}

const keymaps = computed(() => resolved.value.keymaps.map((keymap) => keymap(context)))

function onKeydown(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
  if (keyLink.value) return onKeyLink(event)
  for (const keymap of keymaps.value)
    for (const [hotkey, handler] of Object.entries(keymap))
      if (matchesHotkey(event, hotkey) && handler(event) !== false) {
        event.preventDefault()
        return
      }
  if (onEditKey(event) || onNavigationKey(event)) event.preventDefault()
}

/** Undoes or redoes, and says what changed back. */
function announceTravel(direction: 'undo' | 'redo') {
  const tr = travel(direction)
  if (!tr) return
  const m = messages.value
  // the change as first made: undoing runs the steps backwards
  const step = tr.steps[direction === 'undo' ? tr.steps.length - 1 : 0]!
  void nextTick(() => {
    let change = ''
    if (step.type === 'addLink' || step.type === 'removeLink') {
      const link =
        step.type === 'addLink' ? step.link : tr.before.links.find((l) => l.id === step.id)
      const from = link && tree.value.byId.get(link.from)?.task.title
      const to = link && tree.value.byId.get(link.to)?.task.title
      change =
        step.type === 'addLink' && from && to ? format(m.linked, { from, to }) : m.linkRemoved
    } else if (step.type === 'updateLink') change = m.linkChanged
    else {
      const id = step.type === 'addTask' ? step.task.id : step.id
      const row = tree.value.byId.get(id)
      change = row
        ? describe(row)
        : format(m.taskRemoved, { title: tr.before.tasks.find((t) => t.id === id)?.title ?? '' })
    }
    announce(format(m[direction === 'undo' ? 'undone' : 'redone'], { change }))
  })
}

function onEditKey(event: KeyboardEvent) {
  if (!editable.value) return false
  if (matchesHotkey(event, 'mod+z')) {
    announceTravel('undo')
  } else if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y')) {
    announceTravel('redo')
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedLink.value) {
    const id = selectedLink.value
    transact((tr) => tr.removeLink(id))
    announce(messages.value.linkRemoved)
  } else if (matchesHotkey(event, 'alt+arrowleft')) keyMove(-1, 'move')
  else if (matchesHotkey(event, 'alt+arrowright')) keyMove(1, 'move')
  else if (matchesHotkey(event, 'alt+shift+arrowleft')) keyMove(-1, 'end')
  else if (matchesHotkey(event, 'alt+shift+arrowright')) keyMove(1, 'end')
  else if (matchesHotkey(event, 'l') && active.value) {
    keyLink.value = { from: active.value, to: null, refusal: null }
    announce(format(messages.value.linkMode, { title: task(active.value).title }))
  } else return false
  return true
}

function onNavigationKey(event: KeyboardEvent) {
  if (event.altKey || event.metaKey || event.ctrlKey) return false
  const list = rows.value
  if (!list.length) return false
  const row = active.value ? tree.value.byId.get(active.value) : undefined
  const index = row && row.index >= 0 ? row.index : -1
  const go = (i: number) => focusTask(list[Math.max(0, Math.min(list.length - 1, i))]!.task.id)
  switch (event.key) {
    case 'ArrowDown':
      go(index < 0 ? 0 : index + 1)
      break
    case 'ArrowUp':
      go(index < 0 ? 0 : index - 1)
      break
    case 'Home':
      go(0)
      break
    case 'End':
      go(list.length - 1)
      break
    case 'ArrowRight':
      if (!row) return false
      if (row.summary && row.task.collapsed) toggle(row)
      else if (row.summary) go(index + 1)
      break
    case 'ArrowLeft':
      if (!row) return false
      if (row.summary && !row.task.collapsed) toggle(row)
      else if (row.task.parent != null && tree.value.byId.has(row.task.parent))
        focusTask(row.task.parent)
      break
    case ' ':
    case 'Enter':
      if (!row) return false
      selectedLink.value = null
      if (event.key === 'Enter') selection.value = [row.task.id]
      else
        selection.value = selected.value.has(row.task.id)
          ? selection.value.filter((id) => id !== row.task.id)
          : [...selection.value, row.task.id]
      break
    default:
      return false
  }
  return true
}

// Announcements for screen readers.
const live = ref('')
function announce(text: string) {
  live.value = ''
  void nextTick(() => (live.value = text))
}
const keysHint = `${useId()}-keys`

// Markers ---------------------------------------------------------------------------

const markers = computed(() => {
  const list = [
    ...(props.markers ?? []),
    ...resolved.value.markers.flatMap((fromExtension) => fromExtension(context)),
  ]
  return list.flatMap((marker, index) => {
    const at = parseTime(marker.date)?.at
    if (at == null || at < extent.value.start || at > extent.value.end) return []
    return [{ key: `${index}:${marker.date}`, x: xOf(at), marker }]
  })
})

function onLinkClick(link: GanttLink, event: MouseEvent) {
  selectedLink.value = link.id
  root.value?.focus({ preventScroll: true })
  emit('linkClick', link, event)
}

// Exposed ---------------------------------------------------------------------------

function scrollToDate(date: string) {
  const parsed = parseTime(date)
  if (parsed) scrollToTime(parsed.at)
}

function scrollToToday() {
  scrollToTime(now.value, viewWidth.value / 3)
}

function scrollToTask(id: string) {
  const row = tree.value.byId.get(id)
  if (!row) return
  const el = chart.value
  if (el && row.index >= 0) {
    const top = row.index * props.rowHeight
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + props.rowHeight > el.scrollTop + bodyHeight.value)
      el.scrollTop = top + props.rowHeight - bodyHeight.value
  }
  if (row.span) {
    const left = xOf(row.span.start)
    const right = xOf(row.span.end)
    if (left < scrollLeft.value || right > scrollLeft.value + viewWidth.value)
      scrollToTime(row.span.start)
  }
}

defineExpose<GanttExpose>({
  transact,
  undo,
  redo,
  schedule,
  get canUndo() {
    return canUndo.value
  },
  get canRedo() {
    return canRedo.value
  },
  fit,
  scrollToDate,
  scrollToTask,
  scrollToToday,
  focusTask,
  zoomIn,
  zoomOut,
})

const context: GanttContext = {
  tasks,
  links,
  selection,
  active,
  readonly: computed(() => !editable.value),
  messages,
  scale: computed(() => level.value.name),
  dayWidth,
  rowHeight: computed(() => props.rowHeight),
  rows,
  critical,
  brokenLinks,
  schedule,
  transact,
  undo,
  redo,
  canUndo,
  canRedo,
  fit,
  zoomIn,
  zoomOut,
  scrollToDate,
  scrollToTask,
  scrollToToday,
  focusTask,
  xOf: (time) => {
    const at = typeof time === 'number' ? time : parseTime(time)?.at
    return at == null ? null : xOf(at)
  },
  rowTop: (id) => {
    const row = tree.value.byId.get(id)
    return row && row.index >= 0 ? row.index * props.rowHeight : null
  },
  announce,
}
provide(ganttKey, context)

const rowStyle = (row: GanttRow) => ({ transform: `translateY(${row.index * props.rowHeight}px)` })
</script>

<template>
  <div
    ref="root"
    class="dou-gantt"
    :class="{
      'is-narrow': narrow,
      'is-editable': editable,
      'is-dragging': drag?.started,
      [`is-dragging-${drag?.mode}`]: drag?.started,
      'is-linking': !!keyLink,
    }"
    :style="{ '--dou-gantt-row-height': `${rowHeight}px` }"
    role="group"
    tabindex="0"
    :aria-label="ariaLabel ?? messages.chart"
    :aria-describedby="keysHint"
    @keydown="onKeydown"
  >
    <span :id="keysHint" class="dou-gantt__sr-only">{{ messages.keys }}</span>
    <div class="dou-gantt__sr-only" aria-live="polite">{{ live }}</div>
    <div
      v-if="showTable"
      ref="tablePane"
      class="dou-gantt__table-pane"
      :style="{ width: `${tableSize}px` }"
    >
      <div
        class="dou-gantt__table"
        role="treegrid"
        :aria-rowcount="rows.length"
        :style="{ minWidth: `${tableMinWidth}px` }"
      >
        <div class="dou-gantt__table-head" role="row">
          <div
            v-for="column in columns"
            :key="column.key"
            class="dou-gantt__th"
            :class="[column.align && `is-${column.align}`, { 'is-title': column.key === 'title' }]"
            :style="columnStyle(column)"
            role="columnheader"
          >
            {{ headerOf(column) }}
          </div>
        </div>
        <div ref="tableBody" class="dou-gantt__table-body" @scroll="onTableScroll">
          <div
            class="dou-gantt__table-rows"
            :style="{
              height: `${rows.length * rowHeight + Math.max(0, scrollbar - tableScrollbar)}px`,
            }"
          >
            <div
              v-for="row in visibleRows"
              :key="row.task.id"
              class="dou-gantt__tr"
              :class="{
                'is-selected': selected.has(row.task.id),
                'is-hovered': hovered === row.task.id,
                'is-summary': row.summary,
                'is-active': active === row.task.id,
              }"
              :style="rowStyle(row)"
              :data-row="row.task.id"
              tabindex="-1"
              role="row"
              :aria-level="row.depth + 1"
              :aria-rowindex="row.index + 1"
              :aria-expanded="row.summary ? !row.task.collapsed : undefined"
              :aria-selected="selected.has(row.task.id)"
              @pointerenter="hovered = row.task.id"
              @pointerleave="hovered = null"
              @click="onTaskClick(row, $event)"
              @dblclick="emit('taskDblclick', row.task, $event)"
              @contextmenu="emit('taskContextmenu', row.task, $event)"
            >
              <div
                v-for="column in columns"
                :key="column.key"
                class="dou-gantt__td"
                :class="[
                  column.align && `is-${column.align}`,
                  { 'is-title': column.key === 'title' },
                ]"
                :style="columnStyle(column)"
                role="gridcell"
              >
                <template v-if="column.key === 'title'">
                  <span class="dou-gantt__indent" :style="{ width: `${row.depth * 16}px` }" />
                  <button
                    v-if="row.summary"
                    type="button"
                    class="dou-gantt__toggle"
                    tabindex="-1"
                    :aria-label="row.task.collapsed ? messages.expand : messages.collapse"
                    @click.stop="toggle(row)"
                  >
                    <component :is="row.task.collapsed ? ChevronRightIcon : ChevronDownIcon" />
                  </button>
                  <span v-else class="dou-gantt__toggle-space" />
                </template>
                <span class="dou-gantt__cell-text">
                  <slot
                    name="cell"
                    :task="row.task"
                    :row="row"
                    :column="column"
                    :text="cellText(row, column)"
                  >
                    {{ cellText(row, column) }}
                  </slot>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      ref="chart"
      class="dou-gantt__chart"
      tabindex="-1"
      @scroll.passive="onChartScroll"
      @wheel="onWheel"
    >
      <div class="dou-gantt__canvas" :style="{ width: `${totalWidth}px` }">
        <div class="dou-gantt__header" aria-hidden="true">
          <div class="dou-gantt__tier is-top">
            <div
              v-for="cell in topCells"
              :key="cell.key"
              class="dou-gantt__cell"
              :style="{ left: `${cell.left}px`, width: `${cell.width}px` }"
            >
              <span class="dou-gantt__cell-label">{{ cell.label }}</span>
            </div>
          </div>
          <div class="dou-gantt__tier is-bottom">
            <div
              v-for="cell in bottomCells"
              :key="cell.key"
              class="dou-gantt__cell"
              :class="{
                'is-now': todayX != null && now >= cell.key && now < cell.end,
                'is-off': level.bottom === 'day' && !calendar.isWorkday(dayIndex(cell.key)),
              }"
              :style="{ left: `${cell.left}px`, width: `${cell.width}px` }"
            >
              <span class="dou-gantt__cell-label">{{ cell.label }}</span>
            </div>
          </div>
          <div
            v-if="todayX != null"
            class="dou-gantt__today-mark"
            :style="{ left: `${todayX}px` }"
          />
          <span
            v-for="item in markers"
            :key="item.key"
            class="dou-gantt__marker-label"
            :class="item.marker.tone && `is-${item.marker.tone}`"
            :style="{ left: `${item.x}px` }"
          >
            {{ item.marker.label }}
          </span>
        </div>
        <div
          class="dou-gantt__body"
          :style="{ height: `${rows.length * rowHeight}px` }"
          @pointerdown="onBodyDown"
        >
          <div v-if="!showTable" class="dou-gantt__row-titles">
            <span
              v-for="item in rowTitles"
              :key="item.row.task.id"
              class="dou-gantt__row-title"
              :class="{ 'is-summary': item.row.summary }"
              :style="rowStyle(item.row)"
            >
              {{ item.row.task.title }}
            </span>
          </div>
          <div
            v-for="range in shaded"
            :key="range.key"
            class="dou-gantt__off"
            :style="{ left: `${range.left}px`, width: `${range.width}px` }"
          />
          <div
            v-for="cell in bottomCells"
            :key="cell.key"
            class="dou-gantt__gridline"
            :style="{ left: `${cell.left}px` }"
          />
          <div
            v-for="row in highlightRows"
            :key="row.task.id"
            class="dou-gantt__row-highlight"
            :class="{ 'is-selected': selected.has(row.task.id) }"
            :style="rowStyle(row)"
          />
          <div v-if="todayX != null" class="dou-gantt__today" :style="{ left: `${todayX}px` }" />
          <div
            v-for="item in markers"
            :key="item.key"
            class="dou-gantt__marker"
            :class="item.marker.tone && `is-${item.marker.tone}`"
            :style="{ left: `${item.x}px` }"
          />
          <component :is="layer" v-for="(layer, i) in resolved.below" :key="`below-${i}`" />
          <svg class="dou-gantt__links" :width="totalWidth" :height="rows.length * rowHeight">
            <g
              v-for="item in linkPaths"
              :key="item.link.id"
              class="dou-gantt__link"
              :class="{
                'is-related': selected.has(item.link.from) || selected.has(item.link.to),
                'is-selected': selectedLink === item.link.id,
                'is-broken': brokenLinks.has(item.link.id),
                'is-critical': critical?.links.has(item.link.id),
              }"
              @click="onLinkClick(item.link, $event)"
            >
              <path class="dou-gantt__link-hit" :d="item.d" />
              <path class="dou-gantt__link-line" :d="item.d" />
              <path class="dou-gantt__link-arrow" :d="item.arrow" />
            </g>
            <path
              v-if="draftLink"
              class="dou-gantt__link-draft"
              :class="{ 'is-refused': draftLink.refused }"
              :d="draftLink.d"
            />
          </svg>
          <div
            v-for="bar in bars"
            :key="bar.row.task.id"
            class="dou-gantt__bar-row"
            :class="{
              'is-selected': selected.has(bar.row.task.id),
              'is-active': drag?.started && drag.id === bar.row.task.id,
            }"
            :style="{ transform: `translateY(${bar.top}px)` }"
            @pointerenter="hovered = bar.row.task.id"
            @pointerleave="hovered = null"
          >
            <div
              class="dou-gantt__bar"
              :class="[
                bar.row.task.tone && `is-${bar.row.task.tone}`,
                {
                  'is-summary': bar.row.summary,
                  'is-milestone': bar.row.milestone,
                  'is-selected': selected.has(bar.row.task.id),
                  'is-locked': bar.row.task.locked,
                  'is-link-target': linkHighlight?.id === bar.row.task.id && !linkHighlight.refused,
                  'is-link-refused': linkHighlight?.id === bar.row.task.id && linkHighlight.refused,
                  'is-move-refused':
                    !!dragRefusal && drag?.started && drag.spans.has(bar.row.task.id),
                  'is-active': active === bar.row.task.id,
                  'is-critical': critical?.tasks.has(bar.row.task.id),
                },
              ]"
              :data-task="bar.row.task.id"
              :style="{
                left: `${bar.left}px`,
                width: bar.row.milestone ? undefined : `${bar.width}px`,
              }"
              role="img"
              tabindex="-1"
              :aria-label="bar.aria"
              @pointerdown="onBarDown($event, bar.row)"
              @click="onTaskClick(bar.row, $event)"
              @dblclick="emit('taskDblclick', bar.row.task, $event)"
              @contextmenu="emit('taskContextmenu', bar.row.task, $event)"
            >
              <span
                v-if="!bar.row.milestone && !bar.row.summary && bar.row.progress > 0"
                class="dou-gantt__progress"
                :style="{ width: `${bar.row.progress * 100}%` }"
              />
              <span v-if="bar.label === 'inside'" class="dou-gantt__bar-label">
                <slot name="bar" :task="bar.row.task" :row="bar.row">{{ bar.row.task.title }}</slot>
              </span>
            </div>
            <template v-if="editable && !bar.row.task.locked">
              <template v-if="!bar.row.milestone && !bar.row.summary">
                <span
                  class="dou-gantt__handle is-start"
                  data-handle="start"
                  :style="{ left: `${bar.left}px` }"
                  @pointerdown="onBarDown($event, bar.row)"
                />
                <span
                  class="dou-gantt__handle is-end"
                  data-handle="end"
                  :style="{ left: `${bar.left + bar.width}px` }"
                  @pointerdown="onBarDown($event, bar.row)"
                />
                <span
                  class="dou-gantt__progress-handle"
                  data-handle="progress"
                  :style="{ left: `${bar.left + bar.width * bar.row.progress}px` }"
                  @pointerdown="onBarDown($event, bar.row)"
                />
              </template>
            </template>
            <template v-if="editable">
              <span
                class="dou-gantt__dot is-start"
                data-handle="link-start"
                :style="{ left: `${bar.left - (bar.row.milestone ? 7 : 0)}px` }"
                @pointerdown="onBarDown($event, bar.row)"
              />
              <span
                class="dou-gantt__dot is-end"
                data-handle="link-end"
                :style="{ left: `${bar.left + (bar.row.milestone ? 7 : bar.width)}px` }"
                @pointerdown="onBarDown($event, bar.row)"
              />
            </template>
            <span
              v-if="bar.label === 'outside' && !titled.has(bar.row.task.id)"
              class="dou-gantt__bar-side"
              :class="{ 'is-summary': bar.row.summary }"
              :style="{ left: `${bar.left + sideOffset(bar)}px` }"
            >
              <slot name="bar" :task="bar.row.task" :row="bar.row">{{ bar.row.task.title }}</slot>
            </span>
          </div>
          <div
            v-for="ghost in ghosts"
            :key="ghost.id"
            class="dou-gantt__ghost"
            :class="{ 'is-milestone': ghost.milestone }"
            :style="{
              transform: `translate(${ghost.left}px, ${ghost.top}px)`,
              width: ghost.milestone ? undefined : `${ghost.width}px`,
            }"
          />
          <component :is="layer" v-for="(layer, i) in resolved.above" :key="`above-${i}`" />
          <div
            v-if="dragTip"
            class="dou-gantt__tip"
            :class="{ 'is-refused': dragTip.refused }"
            :style="{ transform: `translate(${dragTip.left}px, ${dragTip.top}px)` }"
          >
            {{ dragTip.text }}
          </div>
        </div>
      </div>
    </div>
    <!-- after the chart, so Tab reaches it last; CSS puts it between the panes -->
    <div
      v-if="showTable"
      class="dou-gantt__divider"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-valuenow="Math.round(tableSize)"
      :aria-valuemin="TABLE_MIN"
      :aria-valuemax="tableMax"
      @pointerdown="onDividerDown"
      @keydown="onDividerKey"
    />
    <component :is="overlay" v-for="(overlay, i) in resolved.overlays" :key="`overlay-${i}`" />
    <slot />
  </div>
</template>
