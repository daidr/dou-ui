<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon } from '@dou-ui/icons'
import { useElementSize, useLocale, useNow } from 'dou-ui'
import { computed, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue'
import { offTime, resolveCalendar } from './core/calendar'
import { arrowPath, roundedPath, routeLink, type BarBox } from './core/geometry'
import type { GanttLink, GanttTask } from './core/model'
import {
  DAY_WIDTH_RANGE,
  hourStep,
  levelByName,
  levelOf,
  unitsBetween,
  type GanttScale,
  type TimeUnit,
} from './core/scale'
import { MINUTES_PER_DAY, dayStart, parseTime, wallClockNow } from './core/time'
import { buildTree, type GanttRow } from './core/tree'
import { dateLabel, durationLabel, endLabel, unitLabel } from './labels'
import { format, useGanttMessages } from './locale'
import type { GanttColumn, GanttEmits, GanttExpose, GanttProps, GanttSlots } from './types'

defineOptions({ name: 'DouGantt' })

const props = withDefaults(defineProps<GanttProps>(), {
  table: true,
  tableWidth: 360,
  rowHeight: 36,
  barLabel: 'auto',
  today: true,
})
const tasks = defineModel<GanttTask[]>('tasks', { default: () => [] })
const links = defineModel<GanttLink[]>('links', { default: () => [] })
const selection = defineModel<string[]>('selection', { default: () => [] })
const scale = defineModel<GanttScale>('scale', { default: 'day' })
const emit = defineEmits<GanttEmits>()
defineSlots<GanttSlots>()

const messages = useGanttMessages(() => props.messages)
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

const tree = computed(() => buildTree(tasks.value))
const rows = computed(() => tree.value.rows)
const calendar = computed(() => resolveCalendar(props.calendar))
const selected = computed(() => new Set(selection.value))

// Time axis -----------------------------------------------------------------------

/** How wide a day is, in px; zooming changes it smoothly. */
const dayWidth = ref(levelByName(scale.value).base)
const level = computed(() => levelOf(dayWidth.value))
/** px per minute. */
const ppm = computed(() => dayWidth.value / MINUTES_PER_DAY)

watch(level, (next) => {
  if (scale.value !== next.name) scale.value = next.name
})
// a picked level zooms around now when it is in view, else around the middle
watch(scale, (name) => {
  if (level.value.name === name) return
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

onMounted(() => {
  measureScrollbar()
  scrollToTime(content.value.start)
})

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

const step = computed(() => (level.value.bottom === 'hour' ? hourStep(dayWidth.value) : 1))
const topCells = computed(() => cells(level.value.top))
const bottomCells = computed(() => cells(level.value.bottom, step.value))

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
  return format(row.summary ? m.summary : m.task, params)
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

const columns = computed<GanttColumn[]>(
  () =>
    props.columns ?? [
      { key: 'title' },
      { key: 'start', width: 96 },
      { key: 'duration', width: 72 },
    ],
)

function headerOf(column: GanttColumn) {
  if (column.label != null) return column.label
  const builtIn = messages.value.columns as Record<string, string>
  return builtIn[column.key] ?? column.key
}

function cellText(row: GanttRow, column: GanttColumn) {
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

const columnStyle = (column: GanttColumn) =>
  column.width ? { flex: `0 0 ${column.width}px`, width: `${column.width}px` } : { flex: '1 1 0' }

function toggle(row: GanttRow) {
  const id = row.task.id
  tasks.value = toRaw(tasks.value).map((task) =>
    task.id === id ? { ...task, collapsed: !task.collapsed || undefined } : task,
  )
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
  select(row.task, event)
  emit('taskClick', row.task, event)
}

const highlightRows = computed(() =>
  visibleRows.value.filter(
    (row) => selected.value.has(row.task.id) || hovered.value === row.task.id,
  ),
)

// Exposed ---------------------------------------------------------------------------

function scrollToDate(date: string) {
  const parsed = parseTime(date)
  if (parsed) scrollToTime(parsed.at)
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

defineExpose<GanttExpose>({ scrollToDate, scrollToTask, zoomIn, zoomOut })

const rowStyle = (row: GanttRow) => ({ transform: `translateY(${row.index * props.rowHeight}px)` })
</script>

<template>
  <div
    ref="root"
    class="dou-gantt"
    :class="{ 'is-narrow': narrow }"
    :style="{ '--dou-gantt-row-height': `${rowHeight}px` }"
    role="group"
    :aria-label="ariaLabel ?? messages.chart"
  >
    <div v-if="showTable" class="dou-gantt__table-pane" :style="{ width: `${tableSize}px` }">
      <div class="dou-gantt__table" role="treegrid" :aria-rowcount="rows.length">
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
            :style="{ height: `${rows.length * rowHeight + scrollbar}px` }"
          >
            <div
              v-for="row in visibleRows"
              :key="row.task.id"
              class="dou-gantt__tr"
              :class="{
                'is-selected': selected.has(row.task.id),
                'is-hovered': hovered === row.task.id,
                'is-summary': row.summary,
              }"
              :style="rowStyle(row)"
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
    <div ref="chart" class="dou-gantt__chart" @scroll.passive="onChartScroll" @wheel="onWheel">
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
              :class="{ 'is-now': todayX != null && now >= cell.key && now < cell.end }"
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
        </div>
        <div class="dou-gantt__body" :style="{ height: `${rows.length * rowHeight}px` }">
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
          <svg class="dou-gantt__links" :width="totalWidth" :height="rows.length * rowHeight">
            <g
              v-for="item in linkPaths"
              :key="item.link.id"
              class="dou-gantt__link"
              :class="{ 'is-related': selected.has(item.link.from) || selected.has(item.link.to) }"
              @click="emit('linkClick', item.link, $event)"
            >
              <path class="dou-gantt__link-hit" :d="item.d" />
              <path class="dou-gantt__link-line" :d="item.d" />
              <path class="dou-gantt__link-arrow" :d="item.arrow" />
            </g>
          </svg>
          <div
            v-for="bar in bars"
            :key="bar.row.task.id"
            class="dou-gantt__bar-row"
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
                },
              ]"
              :style="{
                left: `${bar.left}px`,
                width: bar.row.milestone ? undefined : `${bar.width}px`,
              }"
              role="img"
              :aria-label="bar.aria"
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
            <span
              v-if="bar.label === 'outside'"
              class="dou-gantt__bar-side"
              :class="{ 'is-summary': bar.row.summary }"
              :style="{ left: `${bar.left + (bar.row.milestone ? 12 : bar.width + 8)}px` }"
            >
              <slot name="bar" :task="bar.row.task" :row="bar.row">{{ bar.row.task.title }}</slot>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
