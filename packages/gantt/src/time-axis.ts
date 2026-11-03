import { createScrollLink, scrollPositionOf, useNow, useTouchScroll } from 'dou-ui'
import { computed, onMounted, ref, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { offTime, type WorkCalendar } from './core/calendar'
import {
  DAY_WIDTH_RANGE,
  hourStep,
  levelByName,
  levelOf,
  unitStart,
  unitsBetween,
  type GanttScale,
  type TimeUnit,
} from './core/scale'
import { MINUTES_PER_DAY, dayStart, parseTime, wallClockNow } from './core/time'
import { unitLabel } from './labels'
import type { GanttMessages } from './locale'

/** Room around the visible part that is rendered too, in px. */
const OVERSCAN_X = 320
/** The widest a day gets when fitting, so short plans don't zoom to hours. */
const FIT_MAX = 64
const ZOOM_STEP = 1.5
/**
 * Room kept before the view, in screens and at least in px. Time can only be
 * added there once a scroll is over, so it is enough for a run of fast swipes.
 */
const ROOM_BEFORE = 80
const ROOM_BEFORE_MIN = 32_000
/** Room kept after the view, in screens; time is added there as you scroll. */
const ROOM_AFTER = 4

function fingers(event: TouchEvent) {
  const [a, b] = [event.touches[0]!, event.touches[1]!]
  return { a, b, distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
}

export interface HeaderCell {
  key: number
  end: number
  left: number
  width: number
  label: string
}

export interface TimeAxisOptions {
  /** The scrolling timeline. */
  chart: Readonly<ShallowRef<HTMLElement | null>>
  /** The table body, kept at the same vertical scroll. */
  tableBody: Readonly<ShallowRef<HTMLElement | null>>
  viewWidth: Ref<number>
  scale: Ref<GanttScale | undefined>
  range: () => [string, string] | undefined
  today: () => boolean
  weekStart: ComputedRef<0 | 1>
  calendar: ComputedRef<WorkCalendar>
  messages: ComputedRef<GanttMessages>
  /** The time the content covers, or `null` when nothing is scheduled. */
  content: ComputedRef<{ start: number; end: number } | null>
  /** The width the timeline will have once laid out, for fitting. */
  fitWidth: () => number
}

/**
 * The time axis the gantt chart and the scheduler share: zoom, the extent
 * that grows as you scroll, the header cells, days off and the today line.
 */
export function useTimeAxis(o: TimeAxisOptions) {
  /** How wide a day is, in px; zooming changes it smoothly. */
  const dayWidth = ref(levelByName(o.scale.value ?? 'day').base)
  /** Without a `scale`, the first view picks the day width that fits the content. */
  let fitPending = o.scale.value == null
  const level = computed(() => levelOf(dayWidth.value))
  /** px per minute. */
  const ppm = computed(() => dayWidth.value / MINUTES_PER_DAY)

  watch(level, (next) => {
    if (o.scale.value !== next.name) o.scale.value = next.name
  })
  // a picked level zooms around now when it is in view, else around the middle
  watch(o.scale, (name) => {
    if (!name || level.value.name === name) return
    const x = todayX.value == null ? null : todayX.value - scrollLeft.value
    zoomTo(levelByName(name).base, x != null && x >= 0 && x <= o.viewWidth.value ? x : undefined)
  })

  const nowMs = useNow({ interval: 60_000 })
  const now = computed(() => wallClockNow(new Date(nowMs.value)))

  /** The content's time, or the coming month when nothing is scheduled. */
  const content = computed(() => {
    const known = o.content.value
    if (known) return known
    const start = dayStart(now.value)
    return { start, end: start + 30 * MINUTES_PER_DAY }
  })

  /** The furthest the view has gone either way, so the timeline keeps it. */
  const reach = ref<{ start: number; end: number } | null>(null)

  /** px of room kept before the view. */
  const roomBefore = computed(() =>
    Math.max(ROOM_BEFORE * (o.viewWidth.value || 800), ROOM_BEFORE_MIN),
  )

  /** The span the timeline covers. */
  const extent = computed(() => {
    const fixed = o.range()?.map((text) => parseTime(text))
    if (fixed?.[0] && fixed[1])
      return { start: dayStart(fixed[0].at), end: dayStart(fixed[1].at) + MINUTES_PER_DAY }
    const width = o.viewWidth.value || 800
    const before = roomBefore.value / ppm.value
    const after = Math.max((ROOM_AFTER * width) / ppm.value, 7 * MINUTES_PER_DAY)
    const start = Math.min(content.value.start, reach.value?.start ?? Infinity)
    const end = Math.max(content.value.end, reach.value?.end ?? -Infinity)
    return {
      start: dayStart(start - before),
      end: dayStart(end + after) + MINUTES_PER_DAY,
    }
  })
  const origin = computed(() => extent.value.start)
  const totalWidth = computed(() => Math.ceil((extent.value.end - extent.value.start) * ppm.value))
  const xOf = (at: number) => (at - origin.value) * ppm.value

  // Scrolling ---------------------------------------------------------------------

  const scrollTop = ref(0)
  const scrollLeft = ref(0)
  /**
   * The time at the left edge of the view. It is what stays put: when the
   * extent grows or the zoom changes, the scroll position follows it.
   */
  const viewStart = ref(0)
  const scrollbar = ref(0)

  const touch = useTouchScroll()
  const link = createScrollLink('y')

  function onChartScroll() {
    const el = o.chart.value!
    const body = o.tableBody.value
    // iOS reports positions past either end while the content bounces back
    const { top, left } = scrollPositionOf(el)
    scrollTop.value = top
    scrollLeft.value = left
    viewStart.value = origin.value + left / ppm.value
    if (body) link.follow(el, body)
    grow()
  }

  /** Keeps time `at` on the timeline, adding room around it. */
  function keep(at: number, until = at) {
    const known = reach.value
    const start = Math.min(known?.start ?? at, at)
    const end = Math.max(known?.end ?? until, until)
    if (known?.start !== start || known.end !== end) reach.value = { start, end }
  }

  /**
   * Adds time at the end the view comes near. After the end that is safe at
   * any time. Before the start it moves the content right, and the scroll
   * position has to follow it; iOS drops that move while a touch scroll or
   * its momentum goes on, and the next scroll event would read the old
   * position against the new start. So the room before is wide enough for a
   * run of swipes, and is filled again once the scroll is over.
   */
  function grow() {
    const el = o.chart.value
    if (!el || o.range()) return
    const width = o.viewWidth.value
    const left = scrollPositionOf(el).left
    if (left + width > totalWidth.value - ROOM_AFTER * width)
      keep(viewStart.value, viewStart.value + ((ROOM_AFTER + 1) * width) / ppm.value)
    if (touch.active.value) touch.whenSettled(growBefore)
    else if (left < roomBefore.value / 2) growBefore()
  }

  function growBefore() {
    const el = o.chart.value
    // an end bouncing back reports positions past it
    if (!el || o.range() || el.scrollLeft < 0) return
    if (scrollPositionOf(el).left < roomBefore.value - o.viewWidth.value) keep(viewStart.value)
  }

  function onTableScroll() {
    const body = o.tableBody.value!
    const el = o.chart.value
    if (el) link.follow(body, el)
  }

  // keep the time at the left edge in place as the axis changes under it
  watch(
    [origin, ppm, totalWidth],
    () => {
      const el = o.chart.value
      if (!el) return
      const target = Math.round((viewStart.value - origin.value) * ppm.value)
      if (Math.abs(el.scrollLeft - target) >= 1) el.scrollLeft = target
      scrollLeft.value = scrollPositionOf(el).left
    },
    { flush: 'post' },
  )

  function measureScrollbar() {
    const el = o.chart.value
    if (el) scrollbar.value = el.offsetHeight - el.clientHeight
  }

  function scrollToTime(at: number, offset = 48) {
    // start the view on a whole header cell, so its label isn't cut at the edge
    const target = at - offset / ppm.value
    viewStart.value = unitStart(level.value.bottom, target, o.weekStart.value, headerStep.value)
    if (!o.range()) keep(viewStart.value, viewStart.value + o.viewWidth.value / ppm.value)
    const el = o.chart.value
    if (!el) return
    el.scrollLeft = Math.round((viewStart.value - origin.value) * ppm.value)
    scrollLeft.value = scrollPositionOf(el).left
  }

  function fit() {
    const width = o.fitWidth()
    if (!width) return
    const days = Math.max(1, (content.value.end - content.value.start) / MINUTES_PER_DAY)
    dayWidth.value = Math.min(FIT_MAX, Math.max(DAY_WIDTH_RANGE[0], (width - 96) / days))
    scrollToTime(content.value.start)
  }

  onMounted(() => {
    measureScrollbar()
    scrollToTime(content.value.start)
  })

  /** Fits the content once the timeline has a width, unless a `scale` was given. */
  function fitWhenSized() {
    if (!fitPending || !o.fitWidth() || !o.viewWidth.value) return
    fitPending = false
    fit()
  }

  // Zoom --------------------------------------------------------------------------

  /** Changes the day width, keeping the time under `anchor` (px from the view's left) in place. */
  function zoomTo(width: number, anchor = o.viewWidth.value / 2) {
    const next = Math.min(DAY_WIDTH_RANGE[1], Math.max(DAY_WIDTH_RANGE[0], width))
    const at = viewStart.value + anchor / ppm.value
    dayWidth.value = next
    viewStart.value = at - anchor / ppm.value
    // what was scrolled past at the old zoom could be very wide at the new one
    if (reach.value && !o.range()) {
      reach.value = null
      keep(viewStart.value, viewStart.value + o.viewWidth.value / ppm.value)
    }
  }

  function onWheel(event: WheelEvent) {
    if (!(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    const rect = o.chart.value!.getBoundingClientRect()
    zoomTo(dayWidth.value * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left)
  }

  const zoomIn = () => zoomTo(dayWidth.value * ZOOM_STEP)
  const zoomOut = () => zoomTo(dayWidth.value / ZOOM_STEP)

  /** Two fingers on the timeline zoom it, as a held Ctrl and the wheel do. */
  let pinch: { distance: number; dayWidth: number } | null = null

  /** Starts a pinch when two fingers rest on the timeline; `true` when one began. */
  function pinchStart(event: TouchEvent) {
    const el = o.chart.value
    if (event.touches.length !== 2 || !el) return false
    const { a, b, distance } = fingers(event)
    if (!el.contains(a.target as Node) || !el.contains(b.target as Node)) return false
    pinch = { distance: Math.max(1, distance), dayWidth: dayWidth.value }
    return true
  }

  /** Zooms with the fingers; `true` while a pinch is going on. */
  function pinchMove(event: TouchEvent) {
    if (!pinch || event.touches.length !== 2) return false
    event.preventDefault()
    const { a, b, distance } = fingers(event)
    const rect = o.chart.value!.getBoundingClientRect()
    zoomTo(pinch.dayWidth * (distance / pinch.distance), (a.clientX + b.clientX) / 2 - rect.left)
    return true
  }

  function pinchEnd(event: TouchEvent) {
    if (event.touches.length < 2) pinch = null
  }

  // What is in view ---------------------------------------------------------------

  /** The time in view, with some room either side. */
  const timeWindow = computed(() => ({
    start: origin.value + (scrollLeft.value - OVERSCAN_X) / ppm.value,
    end: origin.value + (scrollLeft.value + (o.viewWidth.value || 800) + OVERSCAN_X) / ppm.value,
  }))

  function cells(unit: TimeUnit, step = 1): HeaderCell[] {
    const { start, end } = timeWindow.value
    return unitsBetween(unit, Math.max(start, origin.value), end, o.weekStart.value, step).map(
      (cell) => ({
        key: cell.start,
        end: cell.end,
        left: xOf(cell.start),
        width: (cell.end - cell.start) * ppm.value,
        label: unitLabel(unit, cell.start, o.messages.value, dayWidth.value),
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
    return offTime(o.calendar.value, start, end, level.value.name === 'hour').map((range) => ({
      key: range.start,
      left: xOf(range.start),
      width: (range.end - range.start) * ppm.value,
    }))
  })

  const todayX = computed(() =>
    o.today() && now.value >= extent.value.start && now.value <= extent.value.end
      ? xOf(now.value)
      : null,
  )

  /** A pointer's x on screen as timeline px. */
  const contentX = (clientX: number) =>
    clientX - o.chart.value!.getBoundingClientRect().left + o.chart.value!.scrollLeft

  function scrollToDate(date: string) {
    const parsed = parseTime(date)
    if (parsed) scrollToTime(parsed.at)
  }

  function scrollToToday() {
    scrollToTime(now.value, o.viewWidth.value / 3)
  }

  return {
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
    measureScrollbar,
    onChartScroll,
    onTableScroll,
    scrollToTime,
    scrollToDate,
    scrollToToday,
    fit,
    fitWhenSized,
    zoomTo,
    zoomIn,
    zoomOut,
    onWheel,
    pinchStart,
    pinchMove,
    pinchEnd,
    timeWindow,
    topCells,
    bottomCells,
    shaded,
    todayX,
  }
}

export type TimeAxis = ReturnType<typeof useTimeAxis>
