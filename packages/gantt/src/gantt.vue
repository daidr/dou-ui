<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronRightIcon,
  IndentIcon,
  ListTreeIcon,
  OutdentIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from '@dou-ui/icons'
import {
  holdPointer,
  matchesHotkey,
  svgToPNG,
  useElementSize,
  useLocale,
  type PointerHold,
} from 'dou-ui'
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
import { resolveGanttExtensions, type GanttHistoryHandler } from './core/extension'
import GanttMenu from './components/gantt-menu.vue'
import CellEditor from './components/cell-editor.vue'
import TimeGrid from './components/time-grid.vue'
import TimeHeader from './components/time-header.vue'
import {
  endKeepingWork,
  isWorkTime,
  nextWorkTime,
  resolveCalendar,
  shiftWorkdays,
  shiftWorkMinutes,
  workdaysBetween,
  workingMinutes,
} from './core/calendar'
import type { GanttMenuItem, GanttMenuTarget } from './core/menu'
import { arrowPath, roundedPath, routeLink, type BarBox } from './core/geometry'
import { baselineSpans } from './core/baseline'
import {
  HEADER as EXPORT_HEADER,
  LINKED_END_ROOM,
  drawGantt,
  paddedRange,
  svgDocument,
  type ExportColumn,
} from './export/draw'
import { readTheme, type ExportTheme } from './export/theme'
import { GanttHistory } from './core/history'
import { readDocument } from './core/document'
import { linkRefusal, linkTypeOf, type GanttLinkRefusal } from './core/links'
import { applyGanttCSV, readGanttCSV, type GanttCSVImportOptions } from './core/csv'
import { createId, spanOf, writeSpan, type GanttLink, type GanttTask } from './core/model'
import { computeCriticalPath, computeSchedule, findBrokenLinks } from './core/schedule'
import {
  emptyDocument,
  GanttTransaction,
  type GanttDocument,
  type GanttStep,
  type GanttTransactionMeta,
} from './core/transaction'
import { DAY_WIDTH_RANGE, levelByName, snapStep, type GanttScale } from './core/scale'
import { MINUTES_PER_DAY, dayIndex, dayStart, formatTime, parseTime } from './core/time'
import { buildTree, type GanttRow } from './core/tree'
import { useTimeAxis } from './time-axis'
import {
  dateLabel,
  datesLabel,
  durationLabel,
  endLabel,
  markerRoom,
  spokenDuration,
  unitLabel,
} from './labels'
import { format, useGanttMessages } from './locale'
import type {
  GanttColumn,
  GanttEmits,
  GanttExpose,
  GanttInsertOptions,
  GanttExportOptions,
  GanttImageOptions,
  GanttMove,
  GanttPrintOptions,
  GanttCSVExportOptions,
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
  menu: true,
  addRow: true,
})
const model = defineModel<GanttDocument>({ default: emptyDocument })
/** The `v-model`, with a wrongly shaped one read as well as it can be. */
const source = computed(() => readDocument(model.value))
const tasks = computed(() => source.value.tasks)
const links = computed(() => source.value.links)
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
/** An extension's history, used instead of the chart's own. */
let customHistory: GanttHistoryHandler | null = null
const canUndo = ref(false)
const canRedo = ref(false)
const syncHistory = () => {
  canUndo.value = customHistory ? customHistory.canUndo() : history.canUndo
  canRedo.value = customHistory ? customHistory.canRedo() : history.canRedo
}
const editable = computed(() => !props.readonly)

/*
 * A bound v-model only catches up when the parent renders, so changes made
 * in the same tick (a drag, then undo) build on the latest commit instead.
 */
let latest: GanttDocument | null = null
const docOf = (): GanttDocument => latest ?? toRaw(source.value)

/** The last transaction committed, for reading out what an extension's undo changed. */
let lastCommit: GanttTransaction | null = null

/** Runs the extensions' `transaction` hooks; `false` when one cancelled the change. */
function check(tr: GanttTransaction) {
  for (const hook of resolved.value.transactions) {
    hook(tr, context)
    if (tr.cancelled) {
      emit('transactionCancel', tr)
      refuse(tr.cancelReason ?? messages.value.changeCancelled)
      return false
    }
  }
  return true
}

function commit(tr: GanttTransaction) {
  if (!check(tr)) return false
  lastCommit = tr
  if (!latest) void nextTick(() => (latest = null))
  latest = tr.doc
  model.value = tr.doc
  if (tr.touches('tasks')) {
    const ids = new Set(tr.doc.tasks.map((task) => task.id))
    const kept = selection.value.filter((id) => ids.has(id))
    if (kept.length !== selection.value.length) selection.value = kept
  }
  if (selectedLink.value && !tr.doc.links.some((link) => link.id === selectedLink.value))
    selectedLink.value = null
  emit('transaction', tr)
  return true
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
  if (!commit(tr)) return tr
  if (!customHistory) history.record(tr, before, selection.value)
  syncHistory()
  return tr
}

function travel(direction: 'undo' | 'redo') {
  if (customHistory) {
    const before = lastCommit
    const done = customHistory[direction]()
    syncHistory()
    return done && lastCommit !== before ? lastCommit : null
  }
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
  announce(format(messages.value.scheduled, { count: result.moves.size }))
  return result
}

const selectedLink = ref<string | null>(null)

// While a bar is dragged, the chart shows the tasks as they would be after the drop.
const drag = shallowRef<Drag | null>(null)
/*
 * The tasks and links as plain arrays. They are replaced, never changed in
 * place, so reading them raw spares tracking every field of every task.
 */
const taskList = computed(() => toRaw(tasks.value))
const linkList = computed(() => toRaw(links.value))
const shown = computed(() => {
  if (!drag.value?.started) return taskList.value
  const changes = dragPreview.value
  if (!changes) return taskList.value
  return taskList.value.map((task) => {
    const patch = changes.get(task.id)
    return patch ? { ...task, ...patch } : task
  })
})

const tree = computed(() => buildTree(shown.value))
const rows = computed(() => tree.value.rows)
const calendar = computed(() => resolveCalendar(props.calendar))
const selected = computed(() => new Set(selection.value))
const shownDoc = computed<GanttDocument>(() => ({
  version: 1,
  tasks: shown.value,
  links: linkList.value,
}))

/** While dragging with automatic scheduling: the tasks the drop would push, and where to. */
/** The tasks a drag is about to change, with the ones it would push, as they would be written. */
const preview = computed<Map<string, Partial<GanttTask>> | null>(() => {
  const changes = dragPreview.value
  const pushes = pushPreview.value?.moves
  if (!changes || !pushes?.size) return changes
  const out = new Map(changes)
  for (const [id, patch] of pushes) out.set(id, patch)
  return out
})

const pushPreview = computed(() => {
  const changes = dragPreview.value
  if (props.scheduling !== 'auto' || !changes || drag.value?.mode === 'progress') return null
  return computeSchedule(shownDoc.value, { calendar: calendar.value, fixed: changes.keys() })
})

/** Links whose later task starts (or ends) before the link allows. */
const brokenLinks = computed(
  () =>
    pushPreview.value?.violated ?? findBrokenLinks(shownDoc.value, { calendar: calendar.value }),
)
const critical = computed(() =>
  props.critical ? computeCriticalPath(shownDoc.value, { calendar: calendar.value }) : null,
)

// Time axis -----------------------------------------------------------------------

/** The time the tasks cover, or `null` when nothing is scheduled. */
const content = computed(() => {
  let start = Infinity
  let end = -Infinity
  for (const row of tree.value.byId.values()) {
    if (!row.span) continue
    start = Math.min(start, row.span.start)
    end = Math.max(end, row.span.end)
  }
  return start > end ? null : { start, end }
})

const axis = useTimeAxis({
  chart,
  tableBody,
  viewWidth,
  scale,
  range: () => props.range,
  today: () => props.today,
  weekStart,
  calendar,
  messages,
  content,
  // worked out from the root, so a table about to step aside doesn't count
  fitWidth: () => (showTable.value ? viewWidth.value : rootWidth.value),
})
const {
  dayWidth,
  level,
  ppm,
  now,
  extent,
  origin,
  totalWidth,
  xOf,
  contentX,
  scrollTop,
  scrollLeft,
  scrollbar,
  onChartScroll,
  onTableScroll,
  scrollToTime,
  scrollToDate,
  scrollToToday,
  fit,
  zoomTo,
  zoomIn,
  zoomOut,
  onWheel,
  timeWindow,
  topCells,
  bottomCells,
  shaded,
  todayX,
} = axis

watch([viewHeight, viewWidth], axis.measureScrollbar, { flush: 'post' })
watch([rootWidth, viewWidth], axis.fitWhenSized)

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
  for (const link of linkList.value) {
    const type = link.type ?? 'fs'
    if (type === 'fs' || type === 'ff') out.add(link.from)
    if (type === 'ff' || type === 'sf') out.add(link.to)
  }
  return out
})

/** Where a bar's side title starts, from the bar's left: clear of a line leaving its end. */
const sideOffset = (bar: Bar) =>
  (bar.row.milestone ? 12 : bar.width + 8) +
  (linkedEnds.value.has(bar.row.task.id) ? LINKED_END_ROOM : 0)

/** Rows titled at the edge; their own side labels would only crowd it. */
const titled = computed(() => new Set(rowTitles.value.map((item) => item.row.task.id)))

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
  if (row.milestone) {
    const text = format(m.milestone, { title: task.title, start })
    const change = planChange(row)
    return change ? format(m.baseline.withChange, { task: text, change }) : text
  }
  const params = {
    title: task.title,
    dates: datesLabel(span, m),
    duration: spokenDuration(span, calendar.value, m),
    progress: Math.round(row.progress * 100),
  }
  let text = format(row.summary ? m.summary : m.task, params)
  if (critical.value?.tasks.has(task.id)) text = format(m.criticalTask, { task: text })
  const change = planChange(row)
  return change ? format(m.baseline.withChange, { task: text, change }) : text
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

// Baseline --------------------------------------------------------------------------

/** How far bars move up to make room for the baseline under them, in px. */
const BASELINE_SHIFT = 4

/** The planned spans, by task. */
const planned = computed(() =>
  props.baseline
    ? baselineSpans(props.baseline, (id) => !!tree.value.byId.get(id)?.milestone)
    : null,
)
const barShift = computed(() => (planned.value ? BASELINE_SHIFT : 0))

/** A thin line under each bar in view, where the baseline had it. */
const baselineBars = computed(() => {
  const plans = planned.value
  if (!plans) return []
  const out: { id: string; left: number; width: number; top: number; milestone: boolean }[] = []
  for (const bar of bars.value) {
    const span = plans.get(bar.row.task.id)
    if (!span) continue
    out.push({
      id: bar.row.task.id,
      left: xOf(span.start),
      width: Math.max(2, (span.end - span.start) * ppm.value),
      top: bar.top,
      milestone: bar.row.milestone,
    })
  }
  return out
})

/** How a task's end compares with its plan, as words; empty when on plan. */
function planChange(row: GanttRow) {
  const plan = planned.value?.get(row.task.id)
  const span = row.span
  if (!plan || !span || plan.end === span.end) return ''
  const m = messages.value
  // in calendar time: a slip over a weekend is still a slip
  const gap = Math.abs(span.end - plan.end)
  const duration =
    plan.dateOnly && span.dateOnly
      ? format(m.days, { count: Math.round(gap / MINUTES_PER_DAY) })
      : format(m.hours, { count: Math.round((gap / 60) * 10) / 10 })
  return format(span.end > plan.end ? m.baseline.late : m.baseline.early, { duration })
}

// Links -----------------------------------------------------------------------------

/** Half the width of a milestone's diamond, where lines meet it. */
const MILESTONE = 7

function boxOf(row: GanttRow): BarBox | null {
  if (!row.span || row.index < 0) return null
  const y = row.index * props.rowHeight + props.rowHeight / 2 - barShift.value
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
  for (const link of linkList.value) {
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
/** The row below the table that adds a task. */
const showAddRow = computed(() => editable.value && props.addRow && showTable.value)
/** Rows of height on both sides: the tasks, and the adding row. */
const bodyRows = computed(() => rows.value.length + (showAddRow.value ? 1 : 0))
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

/** A value of a column of your own, as text. */
function valueText(column: GanttColumn, value: unknown, task: GanttTask) {
  if (column.format) return column.format(value, task)
  return value == null ? '' : String(value)
}

function cellText(row: GanttRow, column: GanttColumn) {
  if (column.value) return valueText(column, column.value(row.task), row.task)
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
    default:
      return valueText(column, row.task.data?.[column.key], row.task)
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

// Editing in the table -------------------------------------------------------------

/** The cell being edited; `id` is `null` for the row that adds a task. */
const editing = ref<{ id: string | null; key: string } | null>(null)

const BUILT_IN_EDITABLE = new Set(['title', 'start', 'end', 'duration', 'progress'])

/** Whether a cell can be edited: built-in columns unless turned off, others when turned on. */
function canEdit(row: GanttRow, column: GanttColumn) {
  if (!editable.value) return false
  if (column.editable === false) return false
  if (!BUILT_IN_EDITABLE.has(column.key) || column.value) return column.editable === true
  if (column.key === 'title') return true
  // a summary's dates and progress come from its children
  if (row.summary || row.task.locked) return false
  if (row.milestone) return column.key === 'start'
  return column.key === 'start' || !!row.span
}

/** Starts editing a cell, the task's title by default. */
function editCell(id: string, key = 'title') {
  const row = tree.value.byId.get(id)
  const column = columns.value.find((item) => item.key === key)
  if (!row || !column || !canEdit(row, column)) return false
  if (row.index < 0) return false
  active.value = id
  scrollToTask(id)
  editing.value = { id, key }
  return true
}

function editorKind(row: GanttRow, column: GanttColumn) {
  const key = column.key
  if (key === 'start' || key === 'end') return row.span && !row.span.dateOnly ? 'datetime' : 'date'
  if (key === 'duration' || key === 'progress') return 'number'
  return BUILT_IN_EDITABLE.has(key) ? 'text' : (column.input ?? 'text')
}

/** What an editor starts with: the value as it would be typed. */
function editorValue(row: GanttRow, column: GanttColumn) {
  const { task, span } = row
  const key = column.key
  switch (key) {
    case 'title':
      return task.title
    case 'start':
      return task.start ?? ''
    case 'end':
      return span
        ? // a date-only span ends on its last day; a summary ending on a milestone, on that day
          formatTime(span.dateOnly ? span.end - 1 : span.end, span.dateOnly)
        : ''
    case 'duration': {
      if (!span) return ''
      const work = span.dateOnly
        ? workdaysBetween(calendar.value, span.start, span.end)
        : workingMinutes(calendar.value, span.start, span.end) / 60
      return String(Math.round(work * 10) / 10)
    }
    case 'progress':
      return String(Math.round(row.progress * 100))
    default: {
      const value = task.data?.[key]
      return value == null ? '' : String(value)
    }
  }
}

/**
 * The change an edited value makes to its task: `null` when it makes
 * none, `false` when the value can't be read.
 */
function editPatch(
  row: GanttRow,
  column: GanttColumn,
  text: string,
): Partial<GanttTask> | null | false {
  const { task, span } = row
  const key = column.key
  const value = text.trim()
  switch (key) {
    case 'title':
      return value && value !== task.title ? { title: value } : null
    case 'start': {
      const at = parseTime(value)
      if (!at) return false
      if (row.milestone) return { start: value }
      if (!span)
        return writeSpan(
          { ...task, start: value },
          at.at,
          at.at + (at.dateOnly ? MINUTES_PER_DAY : 60),
        )
      // a new start moves the task, keeping its work
      return writeSpan(task, at.at, endKeepingWork(calendar.value, span, at.at))
    }
    case 'end': {
      const at = parseTime(value)
      if (!span) return null
      const end = at ? at.at + (at.dateOnly ? MINUTES_PER_DAY : 0) : -Infinity
      return end > span.start ? writeSpan(task, span.start, end) : false
    }
    case 'duration': {
      const count = Number(value)
      if (!span) return null
      if (!value || !Number.isFinite(count) || count <= 0) return false
      const end = span.dateOnly
        ? shiftWorkdays(calendar.value, span.start, count)
        : shiftWorkMinutes(calendar.value, span.start, Math.round(count * 60))
      return writeSpan(task, span.start, end)
    }
    case 'progress': {
      const count = Number(value)
      if (!value || !Number.isFinite(count)) return false
      return { progress: Math.min(100, Math.max(0, count)) / 100 }
    }
    default: {
      const next = column.parse ? column.parse(text, task) : value
      if (next === undefined) return false
      return next === task.data?.[key] ? null : { data: { ...task.data, [key]: next } }
    }
  }
}

/** Says a cell's value can't be read. */
function onEditInvalid(column: GanttColumn) {
  announce(format(messages.value.invalidValue, { column: headerOf(column) }))
}

function onEditDone(row: GanttRow, column: GanttColumn, value: string | null) {
  editing.value = null
  focusTask(row.task.id)
  if (value == null) return
  const patch = editPatch(row, column, value)
  if (!patch) return
  if ('start' in patch) {
    const refusal = checkMove(new Map([[row.task.id, patch]]))
    if (refusal) return announce(refusal)
  }
  const done = transact((tr) => tr.updateTask(row.task.id, patch))
  announceTask(row.task.id, done)
}

/** Tab in the title field indents, Shift+Tab outdents, and editing goes on. */
function onEditTab(row: GanttRow, back: boolean) {
  const id = row.task.id
  const moved = back ? outdentTask(id) : indentTask(id)
  if (moved) void nextTick(() => editCell(id))
}

/** Adds a task at the end, from the row below the table. */
function onAddDone(value: string | null) {
  const title = value?.trim()
  if (value == null) {
    editing.value = null
    root.value?.focus({ preventScroll: true })
    return
  }
  if (!title) return
  const id = createId()
  const last = lastDated()
  const span = newTaskSpan(last && { after: last })
  transact((tr) => tr.addTask({ id, title, ...writeSpan({ id, title }, span.start, span.end) }))
  active.value = id
  void nextTick(() => scrollToTask(id))
  announce(format(messages.value.taskAdded, { title }))
}

/** The lowest row that has dates. */
function lastDated() {
  const list = tree.value.rows
  for (let i = list.length - 1; i >= 0; i--) if (list[i]!.span) return list[i]
  return undefined
}

/**
 * Dates for a new task, so it shows on the timeline: a working day from
 * `at`, or right after the task above it (a working hour, if that one has
 * times), or from today.
 */
function newTaskSpan(from?: { at: number } | { after: GanttRow }) {
  const cal = calendar.value
  const above = from && 'after' in from ? from.after.span : null
  if (above && !above.dateOnly) {
    const start = nextWorkTime(cal, above.end, false)
    return { start, end: shiftWorkMinutes(cal, start, 60) }
  }
  const day = from && 'at' in from ? dayStart(from.at) : (above?.end ?? dayStart(now.value))
  const start = nextWorkTime(cal, day, true)
  return { start, end: shiftWorkdays(cal, start, 1) }
}

/** Adds a task after another one, or as its last subtask, and starts editing its title. */
function insertTask(near: string | null, options: GanttInsertOptions = {}) {
  const { where = 'after' } = options
  const id = createId()
  const title = messages.value.newTask
  const row = near == null ? undefined : tree.value.byId.get(near)
  const inside = !!row && where === 'inside'
  const at = typeof options.start === 'string' ? parseTime(options.start)?.at : options.start
  // the task the new one comes after: the last subtask when adding inside
  const children = row && inside ? (tree.value.childrenOf.get(row.task.id) ?? []) : []
  const above = inside
    ? children.length
      ? tree.value.byId.get(children[children.length - 1]!.id)
      : undefined
    : (row ?? lastDated())
  const span = newTaskSpan(
    at != null ? { at } : above ? { after: above } : row?.span ? { at: row.span.start } : undefined,
  )
  transact((tr) => {
    tr.addTask({ id, title, ...writeSpan({ id, title }, span.start, span.end) })
    if (!row) return
    const nearId = row.task.id
    if (inside) {
      tr.moveTask(id, nearId)
      if (row.task.collapsed) tr.updateTask(nearId, { collapsed: undefined })
    } else {
      const parent = parentOf(nearId)
      const siblings = tree.value.childrenOf.get(parent) ?? []
      tr.moveTask(id, parent, siblings.findIndex((task) => task.id === nearId) + 1)
    }
  })
  selection.value = [id]
  void nextTick(() => editCell(id))
  announce(format(messages.value.taskAdded, { title }))
  return id
}

/** A task's parent as laid out: a missing or looping parent counts as none. */
function parentOf(id: string) {
  for (const [parent, children] of tree.value.childrenOf)
    if (children.some((task) => task.id === id)) return parent
  return undefined
}

/** Makes a task the last subtask of the task above it among its siblings. */
function indentTask(id: string) {
  if (!editable.value) return false
  const siblings = tree.value.childrenOf.get(parentOf(id)) ?? []
  const index = siblings.findIndex((task) => task.id === id)
  const above = siblings[index - 1]
  if (index < 1 || !above || above.type === 'milestone') return false
  transact((tr) => {
    tr.moveTask(id, above.id)
    if (above.collapsed) tr.updateTask(above.id, { collapsed: undefined })
  })
  announceMoved(id)
  return true
}

/** Moves a task out of its parent, to just after it. */
function outdentTask(id: string) {
  if (!editable.value) return false
  const parent = parentOf(id)
  if (parent == null) return false
  const grand = parentOf(parent)
  const index = (tree.value.childrenOf.get(grand) ?? []).findIndex((task) => task.id === parent)
  transact((tr) => tr.moveTask(id, grand, index + 1))
  announceMoved(id)
  return true
}

/** Says where a task went in the outline, once the change has reached the rows. */
function announceMoved(id: string) {
  void nextTick(() => {
    const byId = tree.value.byId
    const task = byId.get(id)?.task.title ?? ''
    const up = parentOf(id)
    const parent = up == null ? undefined : byId.get(up)?.task.title
    const m = messages.value
    announce(parent ? format(m.movedUnder, { task, parent }) : format(m.movedTop, { task }))
  })
}

/** Removes tasks with their subtasks and links, as one undo step. */
function removeTasks(ids: string[]) {
  if (!editable.value || !ids.length) return
  const titles = ids.map((id) => tree.value.byId.get(id)?.task.title).filter(Boolean)
  transact((tr) => {
    for (const id of ids) tr.removeTask(id)
  })
  if (active.value && !tasks.value.some((task) => task.id === active.value)) active.value = null
  announce(
    format(messages.value.tasksRemoved, { titles: titles.join(messages.value.listSeparator) }),
  )
}

function onCellDblclick(row: GanttRow, column: GanttColumn, event: MouseEvent) {
  if (!canEdit(row, column)) return
  event.stopPropagation()
  editCell(row.task.id, column.key)
}

function startAdding() {
  editing.value = { id: null, key: 'title' }
}

// Moving rows in the table -------------------------------------------------------------

interface RowDrag {
  id: string
  pointerId: number
  touch: boolean
  clientX: number
  y0: number
  /** Where the pointer is, in px from the top of the rows. */
  y: number
  clientY: number
  started: boolean
}

const rowDrag = shallowRef<RowDrag | null>(null)
let rowTimer: ReturnType<typeof setTimeout> | undefined
let rowFrame = 0

/** The rows moved together: the pressed one and everything under it. */
const rowDragged = computed(() => {
  const d = rowDrag.value
  if (!d?.started) return null
  const out = new Set([d.id])
  const stack = [d.id]
  while (stack.length)
    for (const child of tree.value.childrenOf.get(stack.pop()) ?? []) {
      out.add(child.id)
      stack.push(child.id)
    }
  return out
})

/** Where a row being dragged would go: before or after a row, or inside it. */
const rowDrop = computed(() => {
  const d = rowDrag.value
  const moved = rowDragged.value
  if (!d?.started || !moved) return null
  const list = rows.value
  if (!list.length) return null
  const h = props.rowHeight
  const index = Math.max(0, Math.min(list.length - 1, Math.floor(d.y / h)))
  const row = list[index]!
  if (moved.has(row.task.id)) return null
  const within = d.y / h - index
  let where: 'before' | 'after' | 'inside' =
    within < 0.3 ? 'before' : within > 0.7 || row.milestone ? 'after' : 'inside'
  if (row.milestone && within < 0.5) where = 'before'
  return { row, where }
})

/** The line showing where a dragged row goes, indented to the level it would take. */
const dropLine = computed(() => {
  const drop = rowDrop.value
  if (!drop || drop.where === 'inside') return null
  const { row, where } = drop
  const first = where === 'after' && row.summary && !row.task.collapsed
  return {
    transform: `translateY(${(row.index + (where === 'after' ? 1 : 0)) * props.rowHeight}px)`,
    left: `${(row.depth + (first ? 1 : 0)) * 16 + 30}px`,
  }
})

function onRowDown(event: PointerEvent, row: GanttRow) {
  if (event.button !== 0 || !editable.value || editing.value) return
  if ((event.target as HTMLElement).closest('button, input, .dou-gantt__editor')) return
  const body = tableBody.value!
  const y = event.clientY - body.getBoundingClientRect().top + body.scrollTop
  const d: RowDrag = {
    id: row.task.id,
    pointerId: event.pointerId,
    touch: event.pointerType === 'touch',
    clientX: event.clientX,
    y0: y,
    y,
    clientY: event.clientY,
    started: false,
  }
  rowDrag.value = d
  hold?.release()
  hold = holdPointer(event, root.value)
  window.addEventListener('pointermove', onRowMove)
  window.addEventListener('pointerup', onRowUp)
  window.addEventListener('pointercancel', stopRowDrag)
  window.addEventListener('keydown', onRowKey, true)
  // a finger picks a row up after a short rest
  if (d.touch)
    rowTimer = setTimeout(() => {
      if (rowDrag.value !== d) return
      beginRowDrag(d)
      navigator.vibrate?.(8)
    }, LONG_PRESS)
}

function beginRowDrag(d: RowDrag) {
  d.started = true
  hold?.grab()
  window.getSelection()?.removeAllRanges()
  rowFrame = requestAnimationFrame(rowAutoScroll)
  rowDrag.value = { ...d }
}

function onRowMove(event: PointerEvent) {
  const d = rowDrag.value
  if (!d || event.pointerId !== d.pointerId) return
  const body = tableBody.value!
  const y = event.clientY - body.getBoundingClientRect().top + body.scrollTop
  if (!d.started) {
    if (Math.abs(y - d.y0) <= THRESHOLD[d.touch ? 'touch' : 'mouse']) return
    if (d.touch) return stopRowDrag()
    beginRowDrag(d)
  }
  rowDrag.value = { ...rowDrag.value!, y, clientY: event.clientY }
}

function rowAutoScroll() {
  const d = rowDrag.value
  const body = tableBody.value
  if (!d?.started || !body) return
  const rect = body.getBoundingClientRect()
  let dy = -edgeSpeed(d.clientY - rect.top) || edgeSpeed(rect.bottom - d.clientY)
  if (Math.sign(dy) !== Math.sign(d.y - d.y0)) dy = 0
  if (dy) {
    body.scrollTop += dy
    onTableScroll()
    rowDrag.value = { ...d, y: d.clientY - rect.top + body.scrollTop }
  }
  rowFrame = requestAnimationFrame(rowAutoScroll)
}

function onRowUp(event: PointerEvent) {
  const d = rowDrag.value
  if (!d || event.pointerId !== d.pointerId) return
  const drop = rowDrop.value
  if (d.touch && d.started && Math.abs(d.y - d.y0) < THRESHOLD.touch) {
    // held, then let go without moving: the row's menu
    stopRowDrag()
    if (!menuAllowed(task(d.id), d.clientX, event.clientY)) return
    return void showMenu({ kind: 'task', task: task(d.id) }, d.clientX, event.clientY)
  }
  if (d.started) {
    dragged = true
    setTimeout(() => (dragged = false))
    if (drop) dropRow(d.id, drop.row, drop.where)
  }
  stopRowDrag()
}

function dropRow(id: string, target: GanttRow, where: 'before' | 'after' | 'inside') {
  const targetId = target.task.id
  transact((tr) => {
    if (where === 'inside') {
      tr.moveTask(id, targetId)
      if (target.task.collapsed) tr.updateTask(targetId, { collapsed: undefined })
      return
    }
    // after an open summary means first among its children
    if (where === 'after' && target.summary && !target.task.collapsed)
      return void tr.moveTask(id, targetId, 0)
    const parent = parentOf(targetId)
    const siblings = (tree.value.childrenOf.get(parent) ?? []).filter((task) => task.id !== id)
    const index = siblings.findIndex((task) => task.id === targetId)
    tr.moveTask(id, parent, where === 'before' ? index : index + 1)
  })
  announceTask(id)
}

function onRowKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !rowDrag.value) return
  event.preventDefault()
  event.stopPropagation()
  stopRowDrag()
}

function stopRowDrag() {
  clearTimeout(rowTimer)
  rowTimer = undefined
  cancelAnimationFrame(rowFrame)
  hold?.release()
  hold = null
  window.removeEventListener('pointermove', onRowMove)
  window.removeEventListener('pointerup', onRowUp)
  window.removeEventListener('pointercancel', stopRowDrag)
  window.removeEventListener('keydown', onRowKey, true)
  rowDrag.value = null
}

onBeforeUnmount(stopRowDrag)

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
  hold?.release()
  hold = holdPointer(event, root.value)
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
  hold?.grab()
  frame = requestAnimationFrame(autoScroll)
  drag.value = { ...d }
}

/*
 * A press on a bar or a row: once it turns into a drag, the touch stops
 * scrolling and stays with the chart, also when the element under the
 * finger is drawn anew (a bar's title steps outside a shrinking bar, a row
 * scrolls out of the rendered window).
 */
let hold: PointerHold | null = null

const onTouchMove = (event: TouchEvent) => void axis.pinchMove(event)
const onTouchEnd = (event: TouchEvent) => axis.pinchEnd(event)

function onTouchStart(event: TouchEvent) {
  // the second finger turns a press on a bar into a pinch
  if (!axis.pinchStart(event)) return
  stopDrag()
  stopRowDrag()
}

onMounted(() => {
  const el = root.value!
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd)
  el.addEventListener('touchcancel', onTouchEnd)
})
onBeforeUnmount(() => {
  const el = root.value
  el?.removeEventListener('touchstart', onTouchStart)
  el?.removeEventListener('touchmove', onTouchMove)
  el?.removeEventListener('touchend', onTouchEnd)
  el?.removeEventListener('touchcancel', onTouchEnd)
})

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
  // only towards where the pointer has gone: a bar picked up by the edge doesn't run off
  let dx = -edgeSpeed(d.clientX - rect.left) || edgeSpeed(rect.right - d.clientX)
  if (Math.sign(dx) !== Math.sign(d.x - d.x0)) dx = 0
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
  // a finger held on a bar and let go without moving: the task's menu
  if (d.touch && d.started && d.mode === 'move' && Math.abs(d.x - d.x0) < THRESHOLD.touch) {
    stopDrag()
    if (!menuAllowed(task(d.id), event.clientX, event.clientY)) return
    return void showMenu({ kind: 'task', task: task(d.id) }, event.clientX, event.clientY)
  }
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
  hold?.release()
  hold = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragCancel)
  window.removeEventListener('keydown', onDragKey, true)
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

// Menus -----------------------------------------------------------------------------------

const menu = useTemplateRef<InstanceType<typeof GanttMenu>>('menu')
const menuItems = shallowRef<GanttMenuItem[]>([])
const menuOpen = ref(false)

/** The built-in items for a target. */
function builtInItems(target: GanttMenuTarget): GanttMenuItem[] {
  const m = messages.value.menu
  if (target.kind === 'link')
    return [
      {
        key: 'remove-link',
        label: m.removeLink,
        icon: TrashIcon,
        tone: 'danger',
        run: () => {
          transact((tr) => tr.removeLink(target.link.id))
          announce(messages.value.linkRemoved)
        },
      },
    ]
  if (target.kind === 'canvas')
    return [
      {
        key: 'add',
        label: m.addTask,
        icon: PlusIcon,
        run: () => insertTask(null, { start: target.time }),
      },
    ]
  const id = target.task.id
  const row = tree.value.byId.get(id)
  const siblings = tree.value.childrenOf.get(parentOf(id)) ?? []
  const index = siblings.findIndex((item) => item.id === id)
  const ids = selected.value.has(id) ? selection.value : [id]
  return [
    { key: 'rename', label: m.rename, icon: EditIcon, shortcut: 'f2', run: () => editCell(id) },
    { key: 'add-after', label: m.addAfter, icon: PlusIcon, run: () => insertTask(id) },
    {
      key: 'add-inside',
      label: m.addInside,
      icon: ListTreeIcon,
      disabled: !!row?.milestone,
      run: () => insertTask(id, { where: 'inside' }),
    },
    {
      key: 'indent',
      label: m.indent,
      icon: IndentIcon,
      shortcut: 'mod+]',
      divided: true,
      disabled: index < 1 || siblings[index - 1]?.type === 'milestone',
      run: () => indentTask(id),
    },
    {
      key: 'outdent',
      label: m.outdent,
      icon: OutdentIcon,
      shortcut: 'mod+[',
      disabled: parentOf(id) == null,
      run: () => outdentTask(id),
    },
    {
      key: 'remove',
      label: ids.length > 1 ? format(m.removeTasks, { count: ids.length }) : m.removeTask,
      icon: TrashIcon,
      shortcut: 'delete',
      tone: 'danger',
      divided: true,
      run: () => removeTasks(ids),
    },
  ]
}

/** Your items, the extensions', then the built-in ones, a separator between each group. */
function itemsFor(target: GanttMenuTarget) {
  const items: GanttMenuItem[] = []
  const groups = [
    props.contextMenu?.(target) ?? [],
    ...resolved.value.menus.map((fn) => fn(context, target)),
  ]
  if (props.menu && editable.value) groups.push(builtInItems(target))
  for (const list of groups)
    list.forEach((item, i) =>
      items.push(i === 0 && items.length ? { ...item, divided: true } : item),
    )
  return items
}

type MenuOn =
  { kind: 'task'; task: GanttTask } | { kind: 'link'; link: GanttLink } | { kind: 'canvas' }

/**
 * Where a menu opened, on the timeline: under the pointer when it is over
 * the timeline, otherwise at the task's start.
 */
function menuPoint(on: MenuOn, x: number, y: number) {
  const rect = chart.value!.getBoundingClientRect()
  const point = {
    x: x - rect.left + chart.value!.scrollLeft,
    y: y - rect.top - HEADER + chart.value!.scrollTop,
  }
  if (on.kind === 'task' && (x < rect.left || x > rect.right)) {
    const row = tree.value.byId.get(on.task.id)
    if (row?.span) point.x = xOf(row.span.start)
    if (row && row.index >= 0) point.y = (row.index + 0.5) * props.rowHeight
  }
  return { point, time: Math.round(origin.value + point.x / ppm.value) }
}

/** Opens the menu for a target at a point on screen; `false` when it has nothing to show. */
function showMenu(on: MenuOn, x: number, y: number) {
  const target = { ...on, ...menuPoint(on, x, y) } as GanttMenuTarget
  const items = itemsFor(target)
  if (!items.length) return false
  if (target.kind === 'task') {
    active.value = target.task.id
    if (!selected.value.has(target.task.id)) selection.value = [target.task.id]
  } else if (target.kind === 'link') selectedLink.value = target.link.id
  menuItems.value = items
  menu.value?.open(x, y)
  return true
}

function runMenuItem(key: unknown) {
  menuItems.value.find((item) => item.key === key)?.run()
}

/** When a finger last went down: its long press opens the menu itself, not the browser's. */
let touchedAt = 0
const onRootPointerdown = (event: PointerEvent) => {
  if (event.pointerType === 'touch') touchedAt = Date.now()
}

/**
 * A menu opened by a resting finger or by the menu key has no browser event:
 * it gets a stand-in, so `taskContextmenu` comes first in every case and
 * `preventDefault()` keeps the menu closed.
 */
function menuAllowed(item: GanttTask, x: number, y: number) {
  const event = new MouseEvent('contextmenu', { cancelable: true, clientX: x, clientY: y })
  emit('taskContextmenu', item, event)
  return !event.defaultPrevented
}

function onTaskContextmenu(row: GanttRow, event: MouseEvent) {
  // a finger's long press opens the menu, and sends the event, when it lets go
  if (Date.now() - touchedAt < 1000) return event.preventDefault()
  emit('taskContextmenu', row.task, event)
  if (event.defaultPrevented) return
  if (showMenu({ kind: 'task', task: row.task }, event.clientX, event.clientY))
    event.preventDefault()
}

function onLinkContextmenu(link: GanttLink, event: MouseEvent) {
  emit('linkContextmenu', link, event)
  if (event.defaultPrevented) return
  if (showMenu({ kind: 'link', link }, event.clientX, event.clientY)) event.preventDefault()
}

function onBodyContextmenu(event: MouseEvent) {
  if (event.defaultPrevented || event.target !== event.currentTarget) {
    if (!(event.target as HTMLElement).matches('.dou-gantt__off, .dou-gantt__gridline')) return
  }
  if (Date.now() - touchedAt < 1000) return event.preventDefault()
  if (showMenu({ kind: 'canvas' }, event.clientX, event.clientY)) event.preventDefault()
}

/** The menu key, or Shift+F10, opens the menu of the task the keyboard is on, at its bar. */
function openKeyMenu() {
  const id = active.value
  const row = id ? tree.value.byId.get(id) : undefined
  if (!row) return false
  const el =
    root.value?.querySelector(`.dou-gantt__bar[data-task="${CSS.escape(row.task.id)}"]`) ??
    root.value?.querySelector(`.dou-gantt__tr[data-row="${CSS.escape(row.task.id)}"]`)
  const rect = el?.getBoundingClientRect()
  if (!rect) return false
  if (!menuAllowed(row.task, rect.left + 8, rect.bottom + 4)) return true
  return showMenu({ kind: 'task', task: row.task }, rect.left + 8, rect.bottom + 4)
}

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
    if (!row) return
    let text = tr ? withPushed(describe(row), tr) : describe(row)
    // say so when the change leaves links into or out of the task not kept
    const count = links.value.filter(
      (link) => (link.from === id || link.to === id) && brokenLinks.value.has(link.id),
    ).length
    if (count) text = format(messages.value.broken, { task: text, count })
    announce(text)
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
  } else if (event.key === 'Delete' && selection.value.length) removeTasks(selection.value)
  else if (event.key === 'F2' && active.value) editCell(active.value)
  else if (matchesHotkey(event, 'mod+]') && active.value) indentTask(active.value)
  else if (matchesHotkey(event, 'mod+[') && active.value) outdentTask(active.value)
  else if (event.key === 'ContextMenu' || matchesHotkey(event, 'shift+f10')) openKeyMenu()
  else if (matchesHotkey(event, 'alt+arrowleft')) keyMove(-1, 'move')
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
/** Set while a cancelled change is being told of, so what follows doesn't say it was made. */
let refusing = false
function announce(text: string) {
  if (refusing) return
  live.value = ''
  void nextTick(() => (live.value = text))
}
/** Why the last change didn't go ahead, shown for a moment over the editor. */
const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(noticeTimer))
/** Says why a change didn't go ahead, once while the same one repeats, as in a drag. */
let lastRefusal = { text: '', at: 0 }
function refuse(text: string) {
  const at = Date.now()
  if (refusing || (text === lastRefusal.text && at - lastRefusal.at < 1000)) return
  lastRefusal = { text, at }
  announce(text)
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3200)
  refusing = true
  void nextTick(() => (refusing = false))
}
const keysHint = `${useId()}-keys`

// Markers ---------------------------------------------------------------------------

const markers = computed(() => {
  const list = [
    ...(props.markers ?? []),
    ...resolved.value.markers.flatMap((fromExtension) => fromExtension(context)),
  ]
  const inRange = list.flatMap((marker, index) => {
    const at = parseTime(marker.date)?.at
    if (at == null || at < extent.value.start || at > extent.value.end) return []
    return [{ key: `${index}:${marker.date}`, x: xOf(at), marker }]
  })
  const room = markerRoom(inRange.map((item) => (item.marker.label ? item.x : -Infinity)))
  return inRange.map((item, i) => ({ ...item, room: room[i]! }))
})

// Export and print --------------------------------------------------------------------

/** The widest drawing made, in px; wider ones are zoomed out to fit. */
const EXPORT_MAX = 16000
/** Room on a printed page, in px at 96 per inch: A4 less 10mm margins. */
const PAGE = { landscape: [1047, 718], portrait: [718, 1047] } as const

/** The columns of the table as drawn, at their widths on screen. */
function exportColumns(): ExportColumn[] {
  const heads = root.value?.querySelectorAll<HTMLElement>('.dou-gantt__th')
  return columns.value.map((column, i) => ({
    title: headerOf(column),
    width:
      heads?.[i]?.offsetWidth ||
      px(column.width) ||
      (column.key === 'title' ? TITLE_MIN + 80 : FLEX_COLUMN + 32),
    align: column.align ?? 'start',
    isTitle: column.key === 'title',
    text: (row: GanttRow) => cellText(row, column),
  }))
}

let measurer: CanvasRenderingContext2D | null | undefined
function exportTextWidth(theme: ExportTheme) {
  if (measurer === undefined)
    try {
      measurer = document.createElement('canvas').getContext('2d')
    } catch {
      measurer = null
    }
  return (text: string, bold = false) => {
    if (!measurer) return text.length * theme.fontSize
    measurer.font = `${bold ? theme.fontWeight : 400} ${theme.fontSize}px ${theme.fontFamily}`
    return measurer.measureText(text).width
  }
}

function drawChart(options: {
  range: 'all' | 'view'
  table: boolean
  dayWidth?: number
  background?: boolean
}) {
  const theme = readTheme(root.value!)
  let width = options.dayWidth ?? dayWidth.value
  let shownRows: readonly GanttRow[] = rows.value
  let start: number
  let end: number
  if (options.range === 'view') {
    start = origin.value + scrollLeft.value / ppm.value
    end = start + (viewWidth.value || 800) / ppm.value
    const top = scrollTop.value
    const bottom = top + bodyHeight.value
    shownRows = rows.value.filter(
      (row) => (row.index + 1) * props.rowHeight > top && row.index * props.rowHeight < bottom,
    )
  } else {
    const known = content.value ?? { start: now.value, end: now.value + MINUTES_PER_DAY }
    if ((known.end - known.start) * (width / MINUTES_PER_DAY) > EXPORT_MAX)
      width = (EXPORT_MAX / (known.end - known.start)) * MINUTES_PER_DAY
    ;({ start, end } = paddedRange(known.start, known.end, width, weekStart.value))
    // titles beside bars that end last need room too
    const pxPerMinute = width / MINUTES_PER_DAY
    const measure = exportTextWidth(theme)
    let right = known.end
    for (const row of rows.value) {
      if (!row.span || props.barLabel === 'none') continue
      const barWidth = (row.span.end - row.span.start) * pxPerMinute
      const outside =
        row.milestone ||
        row.summary ||
        props.barLabel === 'outside' ||
        (props.barLabel === 'auto' && measure(row.task.title) + 20 > barWidth)
      if (outside)
        right = Math.max(
          right,
          row.span.end + (measure(row.task.title) + 24 + LINKED_END_ROOM) / pxPerMinute,
        )
    }
    if (right > end) end = paddedRange(known.start, right, width, weekStart.value).end
  }
  return drawGantt(
    {
      rows: shownRows,
      links: linkList.value,
      columns: options.table ? exportColumns() : [],
      rowHeight: props.rowHeight,
      dayWidth: width,
      start,
      end,
      calendar: calendar.value,
      messages: messages.value,
      weekStart: weekStart.value,
      now: props.today ? now.value : null,
      markers: markers.value.map((item) => ({
        at: parseTime(item.marker.date)!.at,
        label: item.marker.label,
        tone: item.marker.tone,
      })),
      critical: critical.value,
      broken: brokenLinks.value,
      baseline: planned.value,
      barLabel: props.barLabel,
      background: options.background !== false,
      linkedEnds: linkedEnds.value,
      textWidth: exportTextWidth(theme),
    },
    theme,
  )
}

const exportOptions = (options: GanttExportOptions = {}) => ({
  range: options.range ?? 'all',
  table: options.table ?? showTable.value,
  dayWidth: options.scale ? levelByName(options.scale).base : undefined,
  background: options.background,
})

function exportSVG(options?: GanttExportOptions) {
  return svgDocument(drawChart(exportOptions(options)))
}

async function exportPNG(options: GanttImageOptions = {}) {
  const drawing = drawChart(exportOptions(options))
  return svgToPNG(svgDocument(drawing), {
    width: drawing.width,
    height: EXPORT_HEADER + drawing.bodyHeight,
    pixelRatio: options.pixelRatio,
    scope: '@dou-ui/gantt',
    hint: "export range 'view', a coarser scale, or use exportSVG() / toCSV()",
  })
}

/** What a spreadsheet program would start a formula with; kept in step with `@dou-ui/sheet`. */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * A field of CSV: quoted when it has to be, and unless `escape` is off,
 * text that a spreadsheet program would run as a formula (`=…`, `-复盘`)
 * behind a `'`. Numbers stay as they are.
 */
function csvCell(text: string, escape = true) {
  const safe =
    escape && FORMULA_START.test(text) && !Number.isFinite(Number(text.trim())) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** A cell as a spreadsheet reads it: dates as `YYYY-MM-DD`, numbers without units. */
function csvValue(row: GanttRow, column: GanttColumn, mixed: boolean) {
  if (column.value) {
    const value = column.value(row.task)
    if (value == null) return ''
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
  const span = row.span
  if (column.key === 'start')
    return span
      ? formatTime(
          span.start - (row.milestone && span.dateOnly ? MINUTES_PER_DAY / 2 : 0),
          span.dateOnly,
        )
      : ''
  if (row.milestone && ['end', 'duration', 'progress'].includes(column.key)) return ''
  if (column.key === 'duration' && mixed && span)
    return durationLabel(span, calendar.value, messages.value)
  return editorValue(row, column)
}

function toCSV(options: GanttCSVExportOptions = {}) {
  const list = columns.value
  const m = messages.value
  // durations are working days or working hours; the header says which, or each value does when both are in
  const timed = new Set<boolean>()
  for (const row of tree.value.byId.values())
    if (row.span && !row.milestone) timed.add(!row.span.dateOnly)
  const mixed = timed.size > 1
  const header = (column: GanttColumn) => {
    const title = headerOf(column)
    if (options.text || column.value || column.key !== 'duration' || timed.size !== 1) return title
    return format(timed.has(true) ? m.hoursColumn : m.daysColumn, { title })
  }
  const cell = (row: GanttRow, column: GanttColumn) =>
    options.text ? cellText(row, column) : csvValue(row, column, mixed)
  const ids = options.ids ? [m.idColumn, m.parentColumn] : []
  const escape = options.escapeFormulas !== false
  const field = (text: string) => csvCell(text, escape)
  const lines = [[...ids, ...list.map(header)].map(field).join(',')]
  // every task in order, those under a collapsed parent too
  for (const row of tree.value.byId.values()) {
    const own = options.ids ? [row.task.id, row.task.parent ?? ''] : []
    lines.push([...own, ...list.map((column) => cell(row, column))].map(field).join(','))
  }
  // the byte order mark tells spreadsheets the file is UTF-8
  return (options.bom === false ? '' : '\uFEFF') + lines.join('\r\n')
}

function readCSV(text: string, outer?: (id: string) => boolean) {
  return readGanttCSV(text, {
    columns: columns.value,
    messages: messages.value,
    calendar: calendar.value,
    outer,
  })
}

function importCSV(text: string, options: GanttCSVImportOptions = {}) {
  if (!editable.value) return null
  const mode = options.mode ?? 'replace'
  // appended tasks may go under the chart's own
  const result = readCSV(text, mode === 'append' ? (id) => tree.value.byId.has(id) : undefined)
  transact((tr) => applyGanttCSV(tr, result, mode, calendar.value))
  return result
}

const escapeHTML = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function print(options: GanttPrintOptions = {}) {
  const orientation = options.orientation ?? 'landscape'
  const [pageWidth, pageHeight] = PAGE[orientation]
  const table = options.table ?? true
  const columnsWidth = table ? exportColumns().reduce((sum, column) => sum + column.width, 0) : 0
  const known = content.value ?? { start: now.value, end: now.value + MINUTES_PER_DAY }
  // the day width that fits the time into what the table leaves of the page
  let fitted = ((pageWidth - columnsWidth - 48) / (known.end - known.start)) * MINUTES_PER_DAY
  fitted = Math.min(DAY_WIDTH_RANGE[1], Math.max(DAY_WIDTH_RANGE[0], fitted))
  const drawing = drawChart({ range: 'all', table, dayWidth: fitted })
  const perPage = Math.max(
    1,
    Math.floor(
      (pageHeight * Math.max(1, drawing.width / pageWidth) - EXPORT_HEADER) / props.rowHeight,
    ),
  )
  const pages: string[] = []
  for (let top = 0; top < Math.max(1, drawing.bodyHeight); top += perPage * props.rowHeight)
    pages.push(
      `<div class="page">${svgDocument(drawing, { top, height: Math.min(perPage * props.rowHeight, drawing.bodyHeight - top) })}</div>`,
    )
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  document.body.append(iframe)
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(document.title)}</title><style>` +
      `@page{size:A4 ${orientation};margin:10mm}html,body{margin:0}` +
      `.page{break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}` +
      `.page:last-child{break-after:auto}svg{display:block;width:100%;height:auto}` +
      `</style></head><body>${pages.join('')}</body></html>`,
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

function onLinkClick(link: GanttLink, event: MouseEvent) {
  selectedLink.value = link.id
  root.value?.focus({ preventScroll: true })
  emit('linkClick', link, event)
}

// Exposed ---------------------------------------------------------------------------

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
  editCell,
  insertTask,
  indentTask,
  outdentTask,
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
  exportSVG,
  exportPNG,
  toCSV,
  readCSV: (text: string) => readCSV(text),
  importCSV,
  print,
})

const context: GanttContext = {
  doc: source,
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
  preview,
  critical,
  brokenLinks,
  schedule,
  editCell,
  insertTask,
  indentTask,
  outdentTask,
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

// Extensions that hook into the chart's life: set up once mounted, again when the list changes
let cleanups: (() => void)[] = []
let mounted = false
function teardownExtensions() {
  for (const cleanup of cleanups.splice(0)) cleanup()
  customHistory = null
}
let setUp = false
let setupTimes: number[] = []
let setupWarned = false
/** An extension made in the template is new on every render, and set up again each time. */
function warnRepeatedSetup() {
  if (process.env.NODE_ENV === 'production' || setupWarned) return
  const at = Date.now()
  setupTimes = [...setupTimes.filter((time) => at - time < 1000), at]
  if (setupTimes.length < 4) return
  setupWarned = true
  console.warn(
    '[@dou-ui/gantt] the extensions keep being set up again, which also clears undo each time. Create them once in <script setup> instead of in the template.',
  )
}
function setupExtensions() {
  if (setUp) warnRepeatedSetup()
  setUp = true
  teardownExtensions()
  customHistory = resolved.value.history?.(context) ?? null
  for (const setup of resolved.value.setups) {
    const cleanup = setup(context)
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  }
  syncHistory()
}
onMounted(() => {
  mounted = true
  setupExtensions()
})
// A list written inline is new on every render; set up again only when the hooks change.
watch(
  () => [resolved.value.history, ...resolved.value.setups],
  (hooks, before) => {
    if (mounted && (hooks.length !== before.length || hooks.some((hook, i) => hook !== before[i])))
      setupExtensions()
  },
)
onBeforeUnmount(teardownExtensions)

const rowStyle = (row: GanttRow) => ({ transform: `translateY(${row.index * props.rowHeight}px)` })
</script>

<template>
  <div
    ref="root"
    class="dou-gantt"
    :class="{
      'is-narrow': narrow,
      'is-editable': editable,
      'is-dragging': drag?.started || rowDrag?.started,
      'is-dragging-row': rowDrag?.started,
      [`is-dragging-${drag?.mode}`]: drag?.started,
      'is-linking': !!keyLink,
      'has-baseline': !!planned,
    }"
    :style="{ '--dou-gantt-row-height': `${rowHeight}px` }"
    role="group"
    tabindex="0"
    :aria-label="ariaLabel ?? messages.chart"
    :aria-describedby="keysHint"
    @keydown="onKeydown"
    @pointerdown.capture="onRootPointerdown"
  >
    <span :id="keysHint" class="dou-gantt__sr-only">{{ messages.keys }}</span>
    <div class="dou-gantt__sr-only" aria-live="polite">{{ live }}</div>
    <div v-if="notice" class="dou-gantt__notice" aria-hidden="true">{{ notice }}</div>
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
              height: `${bodyRows * rowHeight + Math.max(0, scrollbar - tableScrollbar)}px`,
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
                'is-moving': rowDragged?.has(row.task.id),
                'is-drop-inside': rowDrop?.row === row && rowDrop.where === 'inside',
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
              @pointerdown="onRowDown($event, row)"
              @click="onTaskClick(row, $event)"
              @dblclick="emit('taskDblclick', row.task, $event)"
              @contextmenu="onTaskContextmenu(row, $event)"
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
                @dblclick="onCellDblclick(row, column, $event)"
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
                <CellEditor
                  v-if="editing?.id === row.task.id && editing.key === column.key"
                  :kind="editorKind(row, column)"
                  :value="editorValue(row, column)"
                  :label="format(messages.editCell, { column: headerOf(column) })"
                  :check="(text) => editPatch(row, column, text) !== false"
                  @done="onEditDone(row, column, $event)"
                  @invalid="onEditInvalid(column)"
                  @tab="onEditTab(row, $event)"
                />
                <span v-else class="dou-gantt__cell-text">
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
            <div
              v-if="showAddRow"
              class="dou-gantt__add-row"
              :style="{ transform: `translateY(${rows.length * rowHeight}px)` }"
              role="row"
            >
              <div class="dou-gantt__td is-title" role="gridcell">
                <span class="dou-gantt__toggle-space" />
                <CellEditor
                  v-if="editing && editing.id === null"
                  kind="text"
                  value=""
                  repeat
                  :label="messages.addRow"
                  :placeholder="messages.addRow"
                  @done="onAddDone"
                />
                <button v-else type="button" class="dou-gantt__add" @click="startAdding">
                  <PlusIcon />
                  {{ messages.addRow }}
                </button>
              </div>
            </div>
            <div v-if="dropLine" class="dou-gantt__drop-line" :style="dropLine" />
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
        <TimeHeader
          :top-cells="topCells"
          :bottom-cells="bottomCells"
          :bottom-unit="level.bottom"
          :calendar="calendar"
          :now="now"
          :today-x="todayX"
        >
          <span
            v-for="item in markers"
            :key="item.key"
            class="dou-gantt__marker-label"
            :class="[
              item.marker.tone && `is-${item.marker.tone}`,
              { 'is-cut': item.room !== Infinity, 'is-crowded': !item.room },
            ]"
            :title="item.room !== Infinity ? item.marker.label : undefined"
            :style="{
              left: `${item.x}px`,
              maxWidth: item.room && item.room !== Infinity ? `${item.room}px` : undefined,
            }"
          >
            <span v-if="item.marker.label" class="dou-gantt__marker-text">{{
              item.marker.label
            }}</span>
          </span>
        </TimeHeader>
        <div
          class="dou-gantt__body"
          :style="{ height: `${bodyRows * rowHeight}px` }"
          @pointerdown="onBodyDown"
          @contextmenu="onBodyContextmenu"
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
          <TimeGrid :cells="bottomCells" :shaded="shaded" />
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
              @contextmenu="onLinkContextmenu(item.link, $event)"
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
            v-for="plan in baselineBars"
            :key="`plan:${plan.id}`"
            class="dou-gantt__baseline"
            :class="{ 'is-milestone': plan.milestone }"
            :style="{
              transform: `translate(${plan.left}px, ${plan.top}px)${plan.milestone ? ' rotate(45deg)' : ''}`,
              width: plan.milestone ? undefined : `${plan.width}px`,
            }"
          />
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
              @contextmenu="onTaskContextmenu(bar.row, $event)"
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
              transform: `translate(${ghost.left}px, ${ghost.top}px)${ghost.milestone ? ' rotate(45deg)' : ''}`,
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
      :aria-label="messages.resizeTable"
      tabindex="0"
      aria-orientation="vertical"
      :aria-valuenow="Math.round(tableSize)"
      :aria-valuemin="TABLE_MIN"
      :aria-valuemax="tableMax"
      @pointerdown="onDividerDown"
      @keydown="onDividerKey"
    />
    <component :is="overlay" v-for="(overlay, i) in resolved.overlays" :key="`overlay-${i}`" />
    <GanttMenu ref="menu" v-model:open="menuOpen" :items="menuItems" @select="runMenuItem" />
    <slot />
  </div>
</template>
