<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon, TrashIcon } from '@dou-ui/icons'
import { holdPointer, matchesHotkey, useElementSize, useLocale, type PointerHold } from 'dou-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toRaw,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import GanttMenu from '../components/gantt-menu.vue'
import TimeGrid from '../components/time-grid.vue'
import TimeHeader from '../components/time-header.vue'
import { resolveCalendar } from '../core/calendar'
import { GanttHistory } from '../core/history'
import type { GanttMenuItem } from '../core/menu'
import { spanOf, writeSpan, type GanttTask, type TaskSpan } from '../core/model'
import { snapStep, type GanttScale } from '../core/scale'
import { MINUTES_PER_DAY, parseTime } from '../core/time'
import {
  GanttTransaction,
  type GanttDocument,
  type GanttTransactionMeta,
} from '../core/transaction'
import { dateLabel, durationLabel, endLabel } from '../labels'
import { format, useGanttMessages } from '../locale'
import { useTimeAxis } from '../time-axis'
import {
  groupByResource,
  loadSegments,
  type SchedulerResource,
  type SchedulerLoadSegment,
  type SchedulerItem,
} from './layout'
import type {
  SchedulerEmits,
  SchedulerExpose,
  SchedulerMenuTarget,
  SchedulerMove,
  SchedulerProps,
  SchedulerRange,
  SchedulerSlots,
} from './types'

defineOptions({ name: 'DouScheduler' })

const props = withDefaults(defineProps<SchedulerProps>(), {
  today: true,
  table: true,
  tableWidth: 200,
  rowHeight: 36,
  load: true,
  menu: true,
})
const tasks = defineModel<GanttTask[]>('tasks', { default: () => [] })
const selection = defineModel<string[]>('selection', { default: () => [] })
const scale = defineModel<GanttScale>('scale')
const emit = defineEmits<SchedulerEmits>()
defineSlots<SchedulerSlots>()

const messages = useGanttMessages(() => props.messages)
const sm = computed(() => messages.value.scheduler)
const { locale } = useLocale()
const weekStart = computed(() => props.weekStart ?? locale.value.region.weekStart)
const calendar = computed(() => resolveCalendar(props.calendar))
const editable = computed(() => !props.readonly)

/** Height of the two-row time header, in px. */
const HEADER = 56
/** The distance from one lane to the next, in px. */
const LANE = 28
const OVERSCAN = 240
/** Below this width the list steps aside and the timeline takes the whole width. */
const NARROW = 520
const TABLE_MIN = 120

const root = useTemplateRef<HTMLElement>('root')
const chart = useTemplateRef<HTMLElement>('chart')
const tableBody = useTemplateRef<HTMLElement>('tableBody')
const { width: rootWidth } = useElementSize(root)
const { width: viewWidth, height: viewHeight } = useElementSize(chart)

const narrow = computed(() => rootWidth.value > 0 && rootWidth.value < NARROW)
const showTable = computed(() => props.table && !narrow.value)
const tableSize = ref(props.tableWidth)
watch(
  () => props.tableWidth,
  (width) => (tableSize.value = width),
)

// Document and history -------------------------------------------------------------

const history = new GanttHistory()
const canUndo = ref(false)
const canRedo = ref(false)

/*
 * A bound v-model only catches up when the parent renders, so changes made
 * in the same tick build on the latest commit instead.
 */
let latest: GanttDocument | null = null
const docOf = (): GanttDocument => latest ?? { tasks: toRaw(tasks.value), links: [] }

function commit(tr: GanttTransaction) {
  if (!latest) void nextTick(() => (latest = null))
  latest = tr.doc
  tasks.value = tr.doc.tasks
  const ids = new Set(tr.doc.tasks.map((task) => task.id))
  const kept = selection.value.filter((id) => ids.has(id))
  if (kept.length !== selection.value.length) selection.value = kept
  emit('transaction', tr)
}

/** Applies changes as one transaction, one undo step. */
function transact(fn: (tr: GanttTransaction) => void, meta?: GanttTransactionMeta) {
  const tr = new GanttTransaction(docOf())
  if (meta) tr.setMeta(meta)
  fn(tr)
  if (!tr.changed) return tr
  const before = selection.value
  commit(tr)
  history.record(tr, before, selection.value)
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
  // tasks added from outside, such as a booking for a drawn range, are read out
  const added = tr.steps.flatMap((step) => (step.type === 'addTask' ? [step.task.title] : []))
  if (added.length)
    announce(format(messages.value.taskAdded, { title: added.join(messages.value.listSeparator) }))
  return tr
}

function travel(direction: 'undo' | 'redo') {
  const result = history[direction](docOf())
  if (!result) return null
  result.tr.setMeta({ origin: direction, history: false })
  commit(result.tr)
  selection.value = result.selection
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
  return result.tr
}

const undo = () => !!travel('undo')
const redo = () => !!travel('redo')

/** Undoes or redoes, and reads out the task it changed. */
function announceTravel(direction: 'undo' | 'redo') {
  const tr = travel(direction)
  if (!tr) return
  const m = messages.value
  // the change as first made: undoing runs the steps backwards
  const step = tr.steps[direction === 'undo' ? tr.steps.length - 1 : 0]!
  const id = step.type === 'addTask' ? step.task.id : 'id' in step ? step.id : ''
  void nextTick(() => {
    const found = itemById.value.get(id)
    const change = found
      ? describe(found.item, found.row)
      : format(m.taskRemoved, {
          title: tr.before.tasks.find((task) => task.id === id)?.title ?? '',
        })
    announce(format(m[direction === 'undo' ? 'undone' : 'redone'], { change }))
  })
}

// Rows -------------------------------------------------------------------------------

interface GroupRow {
  kind: 'group'
  key: string
  title: string
  top: number
  height: number
}

interface ResourceRow {
  kind: 'resource'
  key: string
  /** `null` for the row of tasks without a resource. */
  resource: SchedulerResource | null
  title: string
  items: SchedulerItem[]
  lanes: number
  load: SchedulerLoadSegment[]
  capacity: number
  overloaded: boolean
  top: number
  height: number
}

type Row = GroupRow | ResourceRow

const collapsed = ref(new Set<string>())
const drag = shallowRef<Drag | null>(null)
const taskList = computed(() => toRaw(tasks.value))
/** The tasks as shown: while dragging, as they would be after the drop. */
const shown = computed(() => {
  // only once a drag has begun, which is after everything here is set up
  if (!drag.value?.started) return taskList.value
  const plans = planned.value
  if (!plans?.length) return taskList.value
  const patches = new Map(plans.map((plan) => [plan.id, plan.patch]))
  return taskList.value.map((task) => {
    const patch = patches.get(task.id)
    return patch ? { ...task, ...patch } : task
  })
})
const placed = computed(() => groupByResource(shown.value, props.resources))
/**
 * While dragging, rows keep the lanes they had: a row that shrank would
 * pull the rows below up under the pointer.
 */
const keptLanes = shallowRef<Map<string, number> | null>(null)

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  let top = 0
  const push = (row: Omit<GroupRow, 'top'> | Omit<ResourceRow, 'top'>) => {
    out.push({ ...row, top } as Row)
    top += row.height
  }
  const resourceRow = (resource: SchedulerResource | null): Omit<ResourceRow, 'top'> => {
    const entry = placed.value.get(resource?.id ?? '')
    const lanes = Math.max(entry?.lanes ?? 0, keptLanes.value?.get(resource?.id ?? '') ?? 0)
    const load = loadSegments((entry?.items ?? []).map((item) => item.span))
    const capacity = Math.max(1, resource?.capacity ?? 1)
    return {
      kind: 'resource',
      key: resource?.id ?? '',
      resource,
      title: resource?.title ?? sm.value.unassigned,
      items: entry?.items ?? [],
      lanes,
      load,
      capacity,
      overloaded: !!resource && load.some((segment) => segment.count > capacity),
      height: props.rowHeight + Math.max(0, lanes - 1) * LANE,
    }
  }
  const done = new Set<string>()
  for (const resource of props.resources) {
    if (!resource.group) {
      push(resourceRow(resource))
      continue
    }
    if (done.has(resource.group)) continue
    done.add(resource.group)
    const key = `group:${resource.group}`
    push({ kind: 'group', key, title: resource.group, height: props.rowHeight })
    if (collapsed.value.has(key)) continue
    for (const member of props.resources)
      if (member.group === resource.group) push(resourceRow(member))
  }
  if (placed.value.has('')) push(resourceRow(null))
  return out
})

const rowByKey = computed(() => new Map(rows.value.map((row) => [row.key, row])))
const totalHeight = computed(() => {
  const last = rows.value.at(-1)
  return last ? last.top + last.height : 0
})
/** Where each task is drawn. */
const itemById = computed(() => {
  const out = new Map<string, { item: SchedulerItem; row: ResourceRow }>()
  for (const row of rows.value)
    if (row.kind === 'resource') for (const item of row.items) out.set(item.task.id, { item, row })
  return out
})

function toggle(row: GroupRow) {
  const next = new Set(collapsed.value)
  if (next.has(row.key)) next.delete(row.key)
  else next.add(row.key)
  collapsed.value = next
}

// Time axis ----------------------------------------------------------------------------

const content = computed(() => {
  let start = Infinity
  let end = -Infinity
  for (const entry of placed.value.values())
    for (const { span } of entry.items) {
      start = Math.min(start, span.start)
      end = Math.max(end, span.end)
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
  fitWidth: () => (showTable.value ? viewWidth.value : rootWidth.value),
})
const {
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
  topCells,
  bottomCells,
  shaded,
  todayX,
  timeWindow,
} = axis

watch([viewHeight, viewWidth], axis.measureScrollbar, { flush: 'post' })
watch([rootWidth, viewWidth], axis.fitWhenSized)

const markers = computed(() =>
  (props.markers ?? []).flatMap((marker, index) => {
    const at = parseTime(marker.date)?.at
    if (at == null || at < extent.value.start || at > extent.value.end) return []
    return [{ key: `${index}:${marker.date}`, x: xOf(at), marker }]
  }),
)

// What is in view ---------------------------------------------------------------------

const bodyHeight = computed(() => Math.max(0, viewHeight.value - HEADER))

/** The rows in view, with some room above and below. */
const visibleRows = computed(() => {
  const list = rows.value
  const from = scrollTop.value - OVERSCAN
  const to = scrollTop.value + bodyHeight.value + OVERSCAN
  // the first row that ends below `from`
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid]!.top + list[mid]!.height <= from) lo = mid + 1
    else hi = mid
  }
  const out: Row[] = []
  for (let i = lo; i < list.length && list[i]!.top < to; i++) out.push(list[i]!)
  return out
})

const resourceRows = computed(() =>
  visibleRows.value.filter((row): row is ResourceRow => row.kind === 'resource'),
)

/** Where a lane's bar row sits, in body px. */
const laneTop = (row: ResourceRow, lane: number) => row.top + lane * LANE

const describeRow = (row: ResourceRow) => {
  const text = format(sm.value.row, { title: row.title, count: row.items.length })
  return row.overloaded ? format(sm.value.overloaded, { row: text }) : text
}

function describe(item: SchedulerItem, row: ResourceRow) {
  const m = messages.value
  const { task, span } = item
  // as the gantt chart reads them out
  const text =
    task.type === 'milestone' || span.end <= span.start
      ? format(m.milestone, {
          title: task.title,
          start: dateLabel(
            span.start - (span.dateOnly ? MINUTES_PER_DAY / 2 : 0),
            span.dateOnly,
            m,
          ),
        })
      : format(sm.value.task, {
          title: task.title,
          start: dateLabel(span.start, span.dateOnly, m),
          end: endLabel(span, m),
          duration: durationLabel(span, calendar.value, m),
        })
  return format(sm.value.item, { task: text, resource: row.title })
}

const selected = computed(() => new Set(selection.value))

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
  item: SchedulerItem
  row: ResourceRow
  left: number
  width: number
  top: number
  milestone: boolean
  /** The title doesn't fit in the bar: it goes after it. */
  outside: boolean
  aria: string
}

const bars = computed<Bar[]>(() => {
  const { start, end } = timeWindow.value
  const out: Bar[] = []
  for (const row of resourceRows.value)
    for (const item of row.items) {
      const { span } = item
      if (span.end < start || span.start > end) continue
      const milestone = item.task.type === 'milestone'
      const width = Math.max(milestone ? 0 : 2, (span.end - span.start) * ppm.value)
      out.push({
        item,
        row,
        left: xOf(span.start),
        width,
        top: laneTop(row, item.lane),
        milestone,
        outside: milestone || textWidth(item.task.title) + 20 > width,
        aria: describe(item, row),
      })
    }
  return out
})

/** How busy each row in view is, as stretches under it. */
const loads = computed(() => {
  if (!props.load) return []
  const { start, end } = timeWindow.value
  return resourceRows.value.flatMap((row) =>
    row.resource
      ? row.load
          .filter((segment) => segment.end > start && segment.start < end)
          .map((segment) => ({
            key: `${row.key}:${segment.start}`,
            top: row.top + row.height - 6,
            left: xOf(segment.start),
            width: Math.max(1, (segment.end - segment.start) * ppm.value),
            level: Math.min(1, segment.count / row.capacity),
            over: segment.count > row.capacity,
          }))
      : [],
  )
})

/** Without the list, rows show their title at the left edge of the timeline. */
const rowTitles = computed(() => (showTable.value ? [] : visibleRows.value))

// Table ----------------------------------------------------------------------------------

const tableMax = computed(() => Math.max(TABLE_MIN, Math.round((rootWidth.value || 1000) * 0.5)))
const hovered = ref<string | null>(null)

function onDividerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const x0 = event.clientX
  const width0 = tableSize.value
  const move = (e: PointerEvent) =>
    (tableSize.value = Math.min(tableMax.value, Math.max(TABLE_MIN, width0 + e.clientX - x0)))
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

function onDividerKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 40 : 10
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const next = tableSize.value + (event.key === 'ArrowLeft' ? -step : step)
  tableSize.value = Math.min(tableMax.value, Math.max(TABLE_MIN, next))
}

// Selection ------------------------------------------------------------------------------

const active = ref<string | null>(null)

function select(task: GanttTask, event: MouseEvent | KeyboardEvent) {
  const id = task.id
  if (event.shiftKey || event.metaKey || event.ctrlKey)
    selection.value = selected.value.has(id)
      ? selection.value.filter((item) => item !== id)
      : [...selection.value, id]
  else if (selection.value.length !== 1 || selection.value[0] !== id) selection.value = [id]
}

function onTaskClick(task: GanttTask, event: MouseEvent) {
  if (dragged) return
  active.value = task.id
  select(task, event)
  emit('taskClick', task, event)
}

// Dragging ---------------------------------------------------------------------------------

type DragMode = 'move' | 'start' | 'end' | 'draw'

interface Drag {
  mode: DragMode
  /** The task pressed; empty when drawing. */
  id: string
  pointerId: number
  touch: boolean
  /** Where the press was and where the pointer is, in timeline px. */
  x0: number
  x: number
  y0: number
  y: number
  clientX: number
  clientY: number
  started: boolean
  /** The tasks that move, with their spans and rows when the drag began. */
  spans: Map<string, { span: TaskSpan; row: string; lane: number }>
  /** The row pressed, and the row under the pointer. */
  from: string
  to: string
}

const THRESHOLD = { mouse: 3, touch: 6 }
const LONG_PRESS = 300
const EDGE = 32

let dragged = false
let pressTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0
let hold: PointerHold | null = null

const snap = (at: number, step: number) => Math.round(at / step) * step
const edgeSpeed = (gap: number) => (gap < EDGE ? Math.ceil(((EDGE - gap) / EDGE) * 16) : 0)

/** The step a drag snaps to: whole days when any task is date-only. */
function stepFor(spans: Iterable<{ dateOnly: boolean }>) {
  const unit = snapStep(axis.dayWidth.value)
  for (const span of spans) if (span.dateOnly) return Math.max(unit, MINUTES_PER_DAY)
  return unit
}

/** The body y of a pointer. */
const contentY = (clientY: number) =>
  clientY - chart.value!.getBoundingClientRect().top - HEADER + chart.value!.scrollTop

/** The resource row at a body y, if any. */
function resourceRowAt(y: number): ResourceRow | null {
  const list = rows.value
  let lo = 0
  let hi = list.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const row = list[mid]!
    if (y < row.top) hi = mid - 1
    else if (y >= row.top + row.height) lo = mid + 1
    else return row.kind === 'resource' ? row : null
  }
  return null
}

const taskById = (id: string) => docOf().tasks.find((task) => task.id === id)

interface Planned {
  id: string
  span: TaskSpan
  /** The row it goes to. */
  row: string
  patch: Partial<GanttTask>
}

/** What the current drag would do. */
const planned = computed<Planned[] | null>(() => {
  const d = drag.value
  if (!d?.started || d.mode === 'draw') return null
  const delta = (d.x - d.x0) / ppm.value
  const out: Planned[] = []
  const first = d.spans.get(d.id)!
  const unit = stepFor([...d.spans.values()].map((entry) => entry.span))
  for (const [id, entry] of d.spans) {
    const task = taskById(id)
    if (!task) continue
    const { span } = entry
    let start = span.start
    let end = span.end
    if (d.mode === 'move') {
      const shift = snap(first.span.start + delta, unit) - first.span.start
      start += shift
      end += shift
    } else if (d.mode === 'start') start = Math.min(snap(span.start + delta, unit), span.end - unit)
    else end = Math.max(snap(span.end + delta, unit), span.start + unit)
    // tasks from the pressed row follow the pointer to another row
    const row = d.mode === 'move' && entry.row === d.from ? d.to : entry.row
    const patch: Partial<GanttTask> = writeSpan(task, start, end)
    if (row !== entry.row) patch.resource = row || undefined
    out.push({ id, span: { start, end, dateOnly: span.dateOnly }, row, patch })
  }
  return out
})

/**
 * Why `canMove` refuses changes, or `null` when it allows them all. Each
 * patch is checked with the resource it ends up with.
 */
function checkMove(patches: Iterable<{ id: string; patch: Partial<GanttTask> }>) {
  const rule = props.canMove
  if (!rule) return null
  const doc = docOf()
  for (const { id, patch } of patches) {
    const task = taskById(id)
    if (!task) continue
    const next = { ...task, ...patch }
    if (!next.start) continue
    const known = next.resource && props.resources.some((item) => item.id === next.resource)
    const move: SchedulerMove = {
      task,
      start: next.start,
      end: next.end,
      resource: known ? next.resource : undefined,
    }
    const answer = rule(move, doc)
    if (answer === true) continue
    return typeof answer === 'string' && answer ? answer : messages.value.moveRefused
  }
  return null
}

/** Why the current drag would be refused. */
const dragRefusal = computed(() => {
  const plans = planned.value
  return plans?.length ? checkMove(plans) : null
})

/** The range being drawn on an empty part of a row. */
const drawn = computed(() => {
  const d = drag.value
  if (!d?.started || d.mode !== 'draw') return null
  const unit = snapStep(axis.dayWidth.value)
  const a = origin.value + Math.min(d.x0, d.x) / ppm.value
  const b = origin.value + Math.max(d.x0, d.x) / ppm.value
  const start = Math.floor(a / unit) * unit
  const end = Math.max(start + unit, Math.ceil(b / unit) * unit)
  return { row: d.from, start, end, dateOnly: unit >= MINUTES_PER_DAY }
})

/** A dashed outline over the range being drawn. */
const drawnBox = computed(() => {
  const range = drawn.value
  const row = range && rowByKey.value.get(range.row)
  if (!range || row?.kind !== 'resource') return null
  return {
    left: xOf(range.start),
    width: (range.end - range.start) * ppm.value,
    top: row.top,
  }
})

/** The new dates beside the pointer while dragging. */
const dragTip = computed(() => {
  const d = drag.value
  if (!d?.started) return null
  const m = messages.value
  const found = d.mode === 'draw' ? undefined : itemById.value.get(d.id)
  const span = found?.item.span ?? (drawn.value && { ...drawn.value })
  const row = found?.row ?? rowByKey.value.get(d.from)
  if (!span || row?.kind !== 'resource') return null
  const refusal = d.mode === 'draw' ? null : dragRefusal.value
  const text = refusal
    ? refusal
    : span.end > span.start
      ? format(m.rangeTip, {
          start: dateLabel(span.start, span.dateOnly, m),
          end: endLabel(span, m),
          duration: durationLabel(span, calendar.value, m),
        })
      : dateLabel(span.start - (span.dateOnly ? MINUTES_PER_DAY / 2 : 0), span.dateOnly, m)
  return {
    text,
    refused: !!refusal,
    left: Math.max(scrollLeft.value + 8, xOf(span.start)),
    top: laneTop(row, found?.item.lane ?? 0),
  }
})

function startDrag(event: PointerEvent, mode: DragMode, id: string, from: ResourceRow) {
  const touch = event.pointerType === 'touch'
  const spans = new Map<string, { span: TaskSpan; row: string; lane: number }>()
  if (mode !== 'draw') {
    const ids = mode === 'move' && selected.value.has(id) ? selection.value : [id]
    for (const each of ids) {
      const found = itemById.value.get(each)
      if (found && !found.item.task.locked)
        spans.set(each, { span: found.item.span, row: found.row.key, lane: found.item.lane })
    }
    if (!spans.has(id)) return
  }
  hold?.release()
  hold = holdPointer(event, root.value)
  const x = contentX(event.clientX)
  const y = contentY(event.clientY)
  const d: Drag = {
    mode,
    id,
    pointerId: event.pointerId,
    touch,
    x0: x,
    x,
    y0: y,
    y,
    clientX: event.clientX,
    clientY: event.clientY,
    started: false,
    spans,
    from: from.key,
    to: from.key,
  }
  drag.value = d
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', stopDrag)
  window.addEventListener('keydown', onDragKey, true)
  // a finger picks a bar up, or starts a range, after a short rest
  if (touch)
    pressTimer = setTimeout(() => {
      if (drag.value !== d) return
      begin(d)
      navigator.vibrate?.(8)
    }, LONG_PRESS)
}

function begin(d: Drag) {
  d.started = true
  keptLanes.value = new Map(
    rows.value.flatMap((row) => (row.kind === 'resource' ? [[row.key, row.lanes] as const] : [])),
  )
  hold?.grab()
  window.getSelection()?.removeAllRanges()
  frame = requestAnimationFrame(autoScroll)
  drag.value = { ...d }
}

function update(d: Drag, x: number, y: number) {
  const next = { ...d, x, y }
  if (d.mode === 'move') next.to = resourceRowAt(y)?.key ?? d.to
  drag.value = next
}

function onDragMove(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  d.clientX = event.clientX
  d.clientY = event.clientY
  const x = contentX(event.clientX)
  const y = contentY(event.clientY)
  if (!d.started) {
    const moved = Math.hypot(x - d.x0, y - d.y0)
    // a finger that moves before the long press scrolls instead
    if (d.touch) {
      if (moved > THRESHOLD.touch) stopDrag()
      return
    }
    if (moved < THRESHOLD.mouse) return
    begin(d)
  }
  update(drag.value!, x, y)
}

function autoScroll() {
  const d = drag.value
  const el = chart.value
  if (!d?.started || !el) return
  const rect = el.getBoundingClientRect()
  // only towards where the pointer has gone, so a bar picked up by the edge doesn't run off
  let dx = -edgeSpeed(d.clientX - rect.left) || edgeSpeed(rect.right - d.clientX)
  if (Math.sign(dx) !== Math.sign(d.x - d.x0)) dx = 0
  let dy = -edgeSpeed(d.clientY - rect.top - HEADER) || edgeSpeed(rect.bottom - d.clientY)
  if (d.mode !== 'move' || Math.sign(dy) !== Math.sign(d.y - d.y0)) dy = 0
  if (dx || dy) {
    el.scrollLeft += dx
    el.scrollTop += dy
    update(d, contentX(d.clientX), contentY(d.clientY))
  }
  frame = requestAnimationFrame(autoScroll)
}

function onDragEnd(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  // a finger held on a bar and let go without moving: the task's menu
  if (d.touch && d.started && d.mode === 'move' && Math.abs(d.x - d.x0) < THRESHOLD.touch) {
    const found = itemById.value.get(d.id)
    stopDrag()
    if (found) showMenu(taskTarget(found.item.task, found.row), event.clientX, event.clientY)
    return
  }
  if (d.started) {
    dragged = true
    setTimeout(() => (dragged = false))
    if (d.mode === 'draw') finishDraw()
    else finishMove(d)
  } else if (d.mode === 'draw' && !d.touch) selection.value = []
  stopDrag()
}

function finishMove(d: Drag) {
  const plans = planned.value
  if (!plans?.length) return
  if (dragRefusal.value) return void announce(dragRefusal.value)
  transact((tr) => {
    for (const plan of plans) tr.updateTask(plan.id, plan.patch)
  })
  const pressed = plans.find((plan) => plan.id === d.id)
  const row = pressed && rowByKey.value.get(pressed.row)
  if (pressed && pressed.row !== d.from && row)
    announce(format(sm.value.moved, { title: taskById(d.id)?.title ?? '', resource: row.title }))
}

function finishDraw() {
  const range = drawn.value
  if (!range) return
  const span = writeSpan({ id: '', title: '' }, range.start, range.end)
  const out: SchedulerRange = {
    resource: range.row || undefined,
    start: span.start!,
    end: span.end ?? span.start!,
  }
  emit('rangeSelect', out)
}

function onDragKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  stopDrag()
}

function stopDrag() {
  clearTimeout(pressTimer)
  cancelAnimationFrame(frame)
  hold?.release()
  hold = null
  drag.value = null
  keptLanes.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', stopDrag)
  window.removeEventListener('keydown', onDragKey, true)
}

function onBarDown(event: PointerEvent, bar: Bar) {
  if (event.button !== 0 || !editable.value) return
  event.stopPropagation()
  const handle = (event.currentTarget as HTMLElement).dataset.handle
  const mode: DragMode = handle === 'start' || handle === 'end' ? handle : 'move'
  if (bar.item.task.locked) return
  startDrag(event, mode, bar.item.task.id, bar.row)
}

function onBodyDown(event: PointerEvent) {
  if (event.button !== 0 || !editable.value) return
  const row = resourceRowAt(contentY(event.clientY))
  if (row) startDrag(event, 'draw', '', row)
  else if (event.pointerType !== 'touch') selection.value = []
}

// two fingers zoom; while they do, nothing is dragged
const onTouchMove = (event: TouchEvent) => void axis.pinchMove(event)
const onTouchEnd = (event: TouchEvent) => axis.pinchEnd(event)
function onTouchStart(event: TouchEvent) {
  if (axis.pinchStart(event)) stopDrag()
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
  stopDrag()
})

// Menu -------------------------------------------------------------------------------------

const menu = useTemplateRef<InstanceType<typeof GanttMenu>>('menu')
const menuItems = shallowRef<GanttMenuItem[]>([])
const menuOpen = ref(false)

/** The moment under a point on screen, or the task's start when it is off the timeline. */
function timeAt(x: number, fallback: number) {
  const rect = chart.value!.getBoundingClientRect()
  if (x < rect.left || x > rect.right) return fallback
  return Math.round(origin.value + contentX(x) / ppm.value)
}

const taskTarget = (task: GanttTask, row: ResourceRow) =>
  ({ kind: 'task', task, resource: row.resource, time: 0 }) as const

/** Your items, then the built-in one, a separator between them. */
function itemsFor(target: SchedulerMenuTarget) {
  const items: GanttMenuItem[] = [...(props.contextMenu?.(target) ?? [])]
  if (props.menu && editable.value && target.kind === 'task') {
    const ids = selected.value.has(target.task.id) ? selection.value : [target.task.id]
    const m = messages.value.menu
    items.push({
      key: 'remove',
      label: ids.length > 1 ? format(m.removeTasks, { count: ids.length }) : m.removeTask,
      icon: TrashIcon,
      shortcut: 'delete',
      tone: 'danger',
      divided: items.length > 0,
      run: () => removeTasks(ids),
    })
  }
  return items
}

/** Opens the menu at a point on screen; `false` when it has nothing to show. */
function showMenu(on: SchedulerMenuTarget, x: number, y: number) {
  const start = on.kind === 'task' ? (itemById.value.get(on.task.id)?.item.span.start ?? 0) : 0
  const target = { ...on, time: timeAt(x, start) }
  const items = itemsFor(target)
  if (!items.length) return false
  if (target.kind === 'task') {
    active.value = target.task.id
    if (!selected.value.has(target.task.id)) selection.value = [target.task.id]
  }
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

function onTaskContextmenu(bar: Bar, event: MouseEvent) {
  emit('taskContextmenu', bar.item.task, event)
  if (event.defaultPrevented) return
  if (Date.now() - touchedAt < 1000) return event.preventDefault()
  if (showMenu(taskTarget(bar.item.task, bar.row), event.clientX, event.clientY))
    event.preventDefault()
}

function onBodyContextmenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (event.defaultPrevented || target.closest('.dou-gantt__bar-row')) return
  if (Date.now() - touchedAt < 1000) return event.preventDefault()
  const row = resourceRowAt(contentY(event.clientY))
  if (!row) return
  const on = { kind: 'row', resource: row.resource, time: 0 } as const
  if (showMenu(on, event.clientX, event.clientY)) event.preventDefault()
}

/** The menu key, or Shift+F10, opens the menu of the task the keyboard is on, at its bar. */
function openKeyMenu() {
  const found = active.value ? itemById.value.get(active.value) : undefined
  if (!found) return false
  const el = root.value?.querySelector(
    `.dou-gantt__bar[data-task="${CSS.escape(found.item.task.id)}"]`,
  )
  const rect = el?.getBoundingClientRect()
  if (!rect) return false
  return showMenu(taskTarget(found.item.task, found.row), rect.left + 8, rect.bottom + 4)
}

// Keys -------------------------------------------------------------------------------------

const keysHint = useId()
const live = ref('')

function announce(text: string) {
  live.value = ''
  void nextTick(() => (live.value = text))
}

/** The tasks in reading order: row by row, by start. */
const ordered = computed(() => {
  const out: { item: SchedulerItem; row: ResourceRow; index: number }[] = []
  const list = rows.value.filter((row): row is ResourceRow => row.kind === 'resource')
  list.forEach((row, index) => {
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    const items = [...row.items].sort((a, b) => a.span.start - b.span.start || a.lane - b.lane)
    for (const item of items) out.push({ item, row, index })
  })
  return { out, rows: list }
})

function focusTask(id: string) {
  active.value = id
  scrollToTask(id)
  void nextTick(() => {
    const el = root.value?.querySelector<HTMLElement>(
      `.dou-gantt__bar[data-task="${CSS.escape(id)}"]`,
    )
    ;(el ?? root.value)?.focus({ preventScroll: true })
  })
}

function scrollToTask(id: string) {
  const found = itemById.value.get(id)
  const el = chart.value
  if (!found || !el) return
  const top = laneTop(found.row, found.item.lane)
  if (top < el.scrollTop) el.scrollTop = top
  else if (top + props.rowHeight > el.scrollTop + bodyHeight.value)
    el.scrollTop = top + props.rowHeight - bodyHeight.value
  const left = xOf(found.item.span.start)
  const right = xOf(found.item.span.end)
  if (left < scrollLeft.value || right > scrollLeft.value + viewWidth.value)
    axis.scrollToTime(found.item.span.start)
}

/** Arrow keys: the next task along, or the one nearest in time in the row above or below. */
function stepFocus(key: string) {
  const { out, rows: list } = ordered.value
  if (!out.length) return
  const at = out.findIndex((entry) => entry.item.task.id === active.value)
  if (at === -1) return void focusTask(out[0]!.item.task.id)
  const current = out[at]!
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const next = out[at + (key === 'ArrowLeft' ? -1 : 1)]
    if (next && next.row === current.row) focusTask(next.item.task.id)
    return
  }
  const direction = key === 'ArrowUp' ? -1 : 1
  for (let i = current.index + direction; i >= 0 && i < list.length; i += direction) {
    const candidates = out.filter((entry) => entry.index === i)
    if (!candidates.length) continue
    const time = current.item.span.start
    let best = candidates[0]!
    for (const entry of candidates)
      if (Math.abs(entry.item.span.start - time) < Math.abs(best.item.span.start - time))
        best = entry
    return void focusTask(best.item.task.id)
  }
}

/** Alt and the arrow keys: earlier or later, or to the resource above or below. */
function keyMove(key: string) {
  const found = active.value ? itemById.value.get(active.value) : undefined
  if (!found || found.item.task.locked) return
  const { item, row } = found
  const task = item.task
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const unit = stepFor([item.span])
    const shift = key === 'ArrowLeft' ? -unit : unit
    const patch = writeSpan(task, item.span.start + shift, item.span.end + shift)
    const refusal = checkMove([{ id: task.id, patch }])
    if (refusal) return void announce(refusal)
    transact((tr) => tr.updateTask(task.id, patch), { group: `key-move:${task.id}` })
    const span = spanOf(taskById(task.id)!)
    if (span) announce(describe({ ...item, span }, row))
    return
  }
  const list = ordered.value.rows
  const index = list.indexOf(row)
  const target = list[index + (key === 'ArrowUp' ? -1 : 1)]
  if (!target) return
  const refusal = checkMove([{ id: task.id, patch: { resource: target.resource?.id } }])
  if (refusal) return void announce(refusal)
  transact((tr) => tr.updateTask(task.id, { resource: target.resource?.id }))
  announce(format(sm.value.moved, { title: task.title, resource: target.title }))
  focusTask(task.id)
}

function removeSelected() {
  const ids = selection.value.length ? selection.value : active.value ? [active.value] : []
  if (ids.length) removeTasks(ids)
}

function removeTasks(ids: string[]) {
  const titles = ids.map((id) => taskById(id)?.title).filter(Boolean)
  transact((tr) => {
    for (const id of ids) tr.removeTask(id)
  })
  active.value = null
  const m = messages.value
  announce(format(m.tasksRemoved, { titles: titles.join(m.listSeparator) }))
}

function onKeydown(event: KeyboardEvent) {
  if (drag.value) return
  const key = event.key
  if (matchesHotkey(event, 'mod+z')) {
    event.preventDefault()
    if (editable.value) announceTravel('undo')
    return
  }
  if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y')) {
    event.preventDefault()
    if (editable.value) announceTravel('redo')
    return
  }
  if (key.startsWith('Arrow')) {
    event.preventDefault()
    if (event.altKey) {
      if (editable.value) keyMove(key)
    } else stepFocus(key)
    return
  }
  if (key === 'ContextMenu' || matchesHotkey(event, 'shift+f10')) {
    if (openKeyMenu()) event.preventDefault()
    return
  }
  if ((key === 'Delete' || key === 'Backspace') && editable.value) {
    event.preventDefault()
    removeSelected()
    return
  }
  if ((key === 'Enter' || key === ' ') && active.value) {
    event.preventDefault()
    const task = taskById(active.value)
    if (task) select(task, event)
    return
  }
  if (key === 'Escape' && selection.value.length) {
    event.preventDefault()
    selection.value = []
  }
}

// Exposed ------------------------------------------------------------------------------------

defineExpose<SchedulerExpose>({
  transact,
  undo,
  redo,
  get canUndo() {
    return canUndo.value
  },
  get canRedo() {
    return canRedo.value
  },
  fit: axis.fit,
  scrollToDate: axis.scrollToDate,
  scrollToToday: axis.scrollToToday,
  scrollToTask,
  focusTask,
  zoomIn: axis.zoomIn,
  zoomOut: axis.zoomOut,
})
</script>

<template>
  <div
    ref="root"
    class="dou-gantt is-scheduler"
    :class="{
      'is-narrow': narrow,
      'is-editable': editable,
      'is-dragging': drag?.started,
      [`is-dragging-${drag?.mode}`]: drag?.started,
    }"
    :style="{ '--dou-gantt-row-height': `${rowHeight}px`, '--dou-gantt-lane': `${LANE}px` }"
    role="group"
    tabindex="0"
    :aria-label="ariaLabel ?? sm.name"
    :aria-describedby="keysHint"
    @keydown="onKeydown"
    @pointerdown.capture="onRootPointerdown"
  >
    <span :id="keysHint" class="dou-gantt__sr-only">{{ sm.keys }}</span>
    <div class="dou-gantt__sr-only" aria-live="polite">{{ live }}</div>
    <div v-if="showTable" class="dou-gantt__table-pane" :style="{ width: `${tableSize}px` }">
      <div class="dou-gantt__table" role="list" :aria-label="sm.resource">
        <div class="dou-gantt__table-head">
          <div class="dou-gantt__th is-title">{{ sm.resource }}</div>
        </div>
        <div
          ref="tableBody"
          class="dou-gantt__table-body"
          tabindex="-1"
          @scroll="axis.onTableScroll"
        >
          <div class="dou-gantt__table-rows" :style="{ height: `${totalHeight + scrollbar}px` }">
            <div
              v-for="row in visibleRows"
              :key="row.key"
              class="dou-gantt__tr"
              :class="{
                'is-group': row.kind === 'group',
                'is-hovered': hovered === row.key,
                'is-overloaded': row.kind === 'resource' && row.overloaded,
              }"
              :style="{ transform: `translateY(${row.top}px)`, height: `${row.height}px` }"
              :data-row="row.key"
              role="listitem"
              :aria-label="row.kind === 'resource' ? describeRow(row) : row.title"
              @pointerenter="hovered = row.key"
              @pointerleave="hovered = null"
            >
              <div class="dou-gantt__td is-title">
                <template v-if="row.kind === 'group'">
                  <button
                    type="button"
                    class="dou-gantt__toggle"
                    tabindex="-1"
                    :aria-label="collapsed.has(row.key) ? messages.expand : messages.collapse"
                    :aria-expanded="!collapsed.has(row.key)"
                    @click="toggle(row)"
                  >
                    <component :is="collapsed.has(row.key) ? ChevronRightIcon : ChevronDownIcon" />
                  </button>
                  <span class="dou-gantt__cell-text">{{ row.title }}</span>
                </template>
                <template v-else>
                  <span v-if="row.resource?.group" class="dou-gantt__indent" style="width: 16px" />
                  <span class="dou-gantt__toggle-space" />
                  <span class="dou-gantt__cell-text" :class="{ 'is-unassigned': !row.resource }">
                    <slot v-if="row.resource" name="resource" :resource="row.resource">
                      {{ row.title }}
                    </slot>
                    <template v-else>{{ row.title }}</template>
                  </span>
                  <span
                    v-if="row.overloaded"
                    class="dou-gantt__overload"
                    :title="sm.overloadHint"
                    aria-hidden="true"
                  />
                </template>
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
      @scroll.passive="axis.onChartScroll"
      @wheel="axis.onWheel"
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
            :class="item.marker.tone && `is-${item.marker.tone}`"
            :style="{ left: `${item.x}px` }"
          >
            {{ item.marker.label }}
          </span>
        </TimeHeader>
        <div
          class="dou-gantt__body"
          :style="{ height: `${totalHeight}px` }"
          @pointerdown="onBodyDown"
          @contextmenu="onBodyContextmenu"
        >
          <div v-if="!showTable" class="dou-gantt__row-titles">
            <span
              v-for="row in rowTitles"
              :key="row.key"
              class="dou-gantt__row-title"
              :class="{ 'is-summary': row.kind === 'group' }"
              :style="{ transform: `translateY(${row.top}px)` }"
            >
              {{ row.title }}
            </span>
          </div>
          <TimeGrid :cells="bottomCells" :shaded="shaded" />
          <div
            v-for="row in visibleRows"
            :key="row.key"
            class="dou-gantt__lane-row"
            :class="{ 'is-group': row.kind === 'group', 'is-hovered': hovered === row.key }"
            :style="{ transform: `translateY(${row.top}px)`, height: `${row.height}px` }"
          />
          <div v-if="todayX != null" class="dou-gantt__today" :style="{ left: `${todayX}px` }" />
          <div
            v-for="item in markers"
            :key="item.key"
            class="dou-gantt__marker"
            :class="item.marker.tone && `is-${item.marker.tone}`"
            :style="{ left: `${item.x}px` }"
          />
          <div
            v-for="segment in loads"
            :key="segment.key"
            class="dou-gantt__load"
            :class="{ 'is-over': segment.over }"
            :style="{
              transform: `translate(${segment.left}px, ${segment.top}px)`,
              width: `${segment.width}px`,
              '--dou-gantt-load': segment.level,
            }"
          />
          <div
            v-for="bar in bars"
            :key="bar.item.task.id"
            class="dou-gantt__bar-row"
            :class="{
              'is-selected': selected.has(bar.item.task.id),
              'is-active': drag?.started && drag.spans.has(bar.item.task.id),
            }"
            :style="{ transform: `translateY(${bar.top}px)` }"
          >
            <div
              class="dou-gantt__bar"
              :class="[
                bar.item.task.tone && `is-${bar.item.task.tone}`,
                {
                  'is-milestone': bar.milestone,
                  'is-selected': selected.has(bar.item.task.id),
                  'is-locked': bar.item.task.locked,
                  'is-active': active === bar.item.task.id,
                  'is-move-refused':
                    !!dragRefusal && drag?.started && drag.spans.has(bar.item.task.id),
                },
              ]"
              :data-task="bar.item.task.id"
              :style="{
                left: `${bar.left}px`,
                width: bar.milestone ? undefined : `${bar.width}px`,
              }"
              role="img"
              tabindex="-1"
              :aria-label="bar.aria"
              @pointerdown="onBarDown($event, bar)"
              @click="onTaskClick(bar.item.task, $event)"
              @dblclick="emit('taskDblclick', bar.item.task, $event)"
              @contextmenu="onTaskContextmenu(bar, $event)"
            >
              <span v-if="!bar.outside" class="dou-gantt__bar-label">
                <slot name="bar" :task="bar.item.task">{{ bar.item.task.title }}</slot>
              </span>
            </div>
            <template v-if="editable && !bar.item.task.locked && !bar.milestone">
              <span
                class="dou-gantt__handle is-start"
                data-handle="start"
                :style="{ left: `${bar.left}px` }"
                @pointerdown="onBarDown($event, bar)"
              />
              <span
                class="dou-gantt__handle is-end"
                data-handle="end"
                :style="{ left: `${bar.left + bar.width}px` }"
                @pointerdown="onBarDown($event, bar)"
              />
            </template>
            <span
              v-if="bar.outside"
              class="dou-gantt__bar-side"
              :style="{ left: `${bar.left + (bar.milestone ? 12 : bar.width + 8)}px` }"
            >
              <slot name="bar" :task="bar.item.task">{{ bar.item.task.title }}</slot>
            </span>
          </div>
          <div
            v-if="drawnBox"
            class="dou-gantt__ghost"
            :style="{
              transform: `translate(${drawnBox.left}px, ${drawnBox.top}px)`,
              width: `${drawnBox.width}px`,
            }"
          />
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
    <GanttMenu ref="menu" v-model:open="menuOpen" :items="menuItems" @select="runMenuItem" />
    <slot />
  </div>
</template>
