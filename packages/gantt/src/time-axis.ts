import { createScrollLink, scrollPositionOf, useNow, useTouchScroll } from 'dou-ui'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from 'vue'
import { offTime, type WorkCalendar } from './core/calendar'
import {
  DAY_WIDTH_RANGE,
  headerStepFor,
  levelByName,
  levelOf,
  unitStart,
  unitsBetween,
  type GanttScale,
  type TimeUnit,
} from './core/scale'
import {
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  dayStart,
  instantOf,
  parseTime,
  toTimestamp,
  wallClockNow,
  type GanttTime,
} from './core/time'
import { unitLabel } from './labels'
import type { GanttMessages } from './locale'
import type { GanttViewport } from './types'

/** Room around the visible part that is rendered too, in px. */
const OVERSCAN_X = 320
/** The widest a day gets when fitting whole-day plans, so short plans don't zoom to hours. */
const FIT_MAX = 64
const ZOOM_STEP = 1.5
/**
 * Room kept before the view on a touch screen, in screens and at least in
 * px, but no more time than `ROOM_BEFORE_TIME`. Time can only be added there
 * once a touch scroll is over, so it is enough for a long run of fast swipes
 * that never lets the momentum stop. Only what is in view is drawn, so room
 * costs nothing but scroll width.
 */
const ROOM_BEFORE = 300
const ROOM_BEFORE_MIN = 400_000
/** Ten thousand years, in minutes: room for a run of swipes at the widest scale too. */
const ROOM_BEFORE_TIME = 10_000 * 365 * MINUTES_PER_DAY
/** The earliest the timeline goes, some 190,000 years back, well within what a date can be. */
const EARLIEST = -1e11
/**
 * Room kept before the view with a mouse or trackpad, in screens. It is
 * filled as soon as the view comes near the start, and stays small so the
 * scrollbar thumb still shows where the view is.
 */
const ROOM_BEFORE_POINTER = 4
/** Maximum unfixed timeline width in px, well within browser layout coordinate limits. */
const MAX_EXTENT_PX = 8_000_000
/** Room kept after the view, in screens; time is added there as you scroll. */
const ROOM_AFTER = 4

const preventSelect = (event: Event) => event.preventDefault()

let selectionLocks = 0
let savedUserSelect = ''
let savedWebkitUserSelect = ''
let savedCursor = ''
let cursorLocks = 0

/**
 * Blocks browser text selection across the entire document (and optionally locks
 * the root cursor) until the returned cleanup is called. Safe for nested calls.
 */
export function lockSelection(cursor?: string) {
  if (typeof document === 'undefined') return () => {}
  const docEl = document.documentElement
  const style = docEl.style as CSSStyleDeclaration & { webkitUserSelect?: string }
  if (selectionLocks === 0) {
    savedUserSelect = style.userSelect
    savedWebkitUserSelect = style.webkitUserSelect ?? ''
    style.userSelect = 'none'
    style.webkitUserSelect = 'none'
    document.addEventListener('selectstart', preventSelect)
  }
  selectionLocks++
  if (cursor) {
    if (cursorLocks === 0) savedCursor = style.cursor
    cursorLocks++
    style.cursor = cursor
  }
  window.getSelection()?.removeAllRanges()
  let active = true
  return () => {
    if (!active) return
    active = false
    selectionLocks = Math.max(0, selectionLocks - 1)
    if (selectionLocks === 0) {
      style.userSelect = savedUserSelect
      style.webkitUserSelect = savedWebkitUserSelect
      document.removeEventListener('selectstart', preventSelect)
    }
    if (cursor) {
      cursorLocks = Math.max(0, cursorLocks - 1)
      if (cursorLocks === 0) style.cursor = savedCursor
    }
  }
}

/** Parses a marker's `[date, endDate]` interval into wall-clock minutes, or `null` when invalid or single-point. */
export function markerSpanOf(date: GanttTime, endDate: GanttTime | undefined) {
  if (endDate == null) return null
  const from = parseTime(date)
  const to = parseTime(endDate)
  if (!from || !to) return null
  const start = from.dateOnly ? dayStart(from.at) : from.at
  let end = to.dateOnly ? dayStart(to.at) + MINUTES_PER_DAY : to.at
  if (end <= start) {
    const startMs = instantOf(date)
    const endMs = instantOf(endDate)
    if (startMs != null && endMs != null && endMs > startMs)
      end = start + (endMs - startMs) / 60_000
  }
  return end > start ? { start, end } : null
}

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

export interface TimeAxisContent {
  start: number
  end: number
  /** True when all scheduled items have explicit times of day (not date-only). */
  timed?: boolean
}

export interface TimeAxisOptions {
  /** The scrolling timeline. */
  chart: Readonly<ShallowRef<HTMLElement | null>>
  /** The table body, kept at the same vertical scroll. */
  tableBody: Readonly<ShallowRef<HTMLElement | null>>
  viewWidth: Ref<number>
  scale: Ref<GanttScale | undefined>
  /** Follow the current time on the right edge; turns off on horizontal user scroll/drag. */
  follow?: Ref<boolean>
  range: () => [GanttTime, GanttTime] | undefined
  today: () => boolean
  /** Optional external current time (e.g. server clock); falls back to `useNow()`. */
  now?: () => GanttTime | undefined
  /** Called when the visible time range or timeline geometry changes. */
  onViewportChange?: (viewport: GanttViewport) => void
  weekStart: ComputedRef<0 | 1>
  calendar: ComputedRef<WorkCalendar>
  messages: ComputedRef<GanttMessages>
  /** The time the content covers, or `null` when nothing is scheduled. */
  content: ComputedRef<TimeAxisContent | null>
  /** The width the timeline will have once laid out, for fitting. */
  fitWidth: () => number
}

const alignFloor = (at: number, unit: number) => Math.floor(at / unit) * unit
const alignCeil = (at: number, unit: number) => Math.ceil(at / unit) * unit

/**
 * The time axis the gantt chart and the scheduler share: zoom, the extent
 * that grows as you scroll, the header cells, days off, the today line and
 * live Follow Now panning.
 */
export function useTimeAxis(o: TimeAxisOptions) {
  const follow = o.follow ?? ref(false)
  /** How wide a day is, in px; zooming changes it smoothly. */
  const dayWidth = ref(levelByName(o.scale.value ?? 'day').base)
  /** Without a `scale`, the first view picks the day width that fits the content. */
  let fitPending = o.scale.value == null && !follow.value
  let pendingFitRange: [GanttTime, GanttTime] | null = null
  const level = computed(() => levelOf(dayWidth.value))
  /** px per minute. */
  const ppm = computed(() => dayWidth.value / MINUTES_PER_DAY)

  watch(level, (next) => {
    if (o.scale.value !== next.name) o.scale.value = next.name
  })
  // a picked level zooms around now when it is in view (or while following), else around the middle
  watch(o.scale, (name) => {
    if (!name || level.value.name === name) return
    const x = todayX.value == null ? null : todayX.value - scrollLeft.value
    zoomTo(levelByName(name).base, x != null && x >= 0 && x <= o.viewWidth.value ? x : undefined)
  })

  const externalNow = computed(() => {
    const raw = o.now?.()
    if (raw == null) return null
    const parsed = parseTime(raw)
    if (!parsed) return null
    return parsed.dateOnly ? dayStart(parsed.at) : parsed.at
  })
  const nowInterval = computed(() =>
    externalNow.value != null
      ? 3_600_000
      : follow.value || level.value.name === 'second' || level.value.name === 'minute'
        ? 1000
        : 60_000,
  )
  const nowMs = useNow({ interval: nowInterval })
  const now = computed(() => externalNow.value ?? wallClockNow(new Date(nowMs.value)))

  /** Right-side breathing room kept past `now` while following, in px. */
  const followMargin = computed(() => {
    const width = o.viewWidth.value || 800
    return Math.min(80, Math.round(width * 0.12))
  })
  /** Horizontal offset of `now` from the left edge of the viewport while following, in px. */
  const followAnchor = computed(() => Math.max(0, (o.viewWidth.value || 800) - followMargin.value))

  /** The content's time, or a sensible default window when nothing is scheduled. */
  const content = computed<TimeAxisContent>(() => {
    const known = o.content.value
    if (known) return known
    if (follow.value || dayWidth.value >= 2880)
      return { start: now.value - MINUTES_PER_HOUR, end: now.value, timed: true }
    const start = dayStart(now.value)
    return { start, end: start + 30 * MINUTES_PER_DAY, timed: false }
  })

  /** The furthest the view has gone either way, so the timeline keeps it. */
  const reach = ref<{ start: number; end: number } | null>(null)

  /** Whether there is a touch screen; read once mounted, so the server render matches. */
  const coarse = ref(false)
  const roomBefore = computed(() => {
    const width = o.viewWidth.value || 800
    if (!coarse.value) return ROOM_BEFORE_POINTER * width
    return Math.min(Math.max(ROOM_BEFORE * width, ROOM_BEFORE_MIN), ROOM_BEFORE_TIME * ppm.value)
  })

  /** Alignment granularity for free timeline edges so sub-hour scales stay compact. */
  const padUnit = computed(() => {
    if (level.value.name === 'second') return 1
    if (level.value.name === 'minute') return MINUTES_PER_HOUR
    return MINUTES_PER_DAY
  })

  const touch = useTouchScroll()

  /** Where the timeline would start, without a fixed range. */
  const freeStart = computed(() => {
    const start = Math.min(
      content.value.start,
      reach.value?.start ?? Infinity,
      follow.value ? now.value - followAnchor.value / ppm.value : Infinity,
    )
    const unit = padUnit.value
    const target = start - roomBefore.value / ppm.value
    return Math.max(
      EARLIEST,
      unit === MINUTES_PER_DAY ? dayStart(target) : alignFloor(target, unit),
    )
  })

  /**
   * The start held while a touch scroll goes on. A later start moves the
   * content, and the scroll position has to follow it, which iOS drops then:
   * content coming in earlier, the room changing as the screen turns. So the
   * start stays where it was and moves once the scroll is over.
   */
  const heldStart = ref<number | null>(null)
  watch(
    touch.active,
    (on) => {
      heldStart.value = on ? extent.value.start : null
    },
    { flush: 'sync' },
  )

  /** The span the timeline covers. */
  const extent = computed(() => {
    const rawRange = o.range()
    const fixed = rawRange?.map((value) => parseTime(value))
    if (fixed?.[0] && fixed[1]) {
      const start = fixed[0].dateOnly ? dayStart(fixed[0].at) : fixed[0].at
      let end = fixed[1].dateOnly ? dayStart(fixed[1].at) + MINUTES_PER_DAY : fixed[1].at
      if (end <= start) {
        const startMs = instantOf(rawRange![0])
        const endMs = instantOf(rawRange![1])
        if (startMs != null && endMs != null && endMs > startMs)
          end = start + (endMs - startMs) / 60_000
      }
      if (end > start) return { start, end }
    }
    const width = o.viewWidth.value || 800
    const unit = padUnit.value
    const after =
      unit === MINUTES_PER_DAY
        ? Math.max((ROOM_AFTER * width) / ppm.value, 7 * MINUTES_PER_DAY)
        : Math.max((ROOM_AFTER * width) / ppm.value, 4 * unit)
    const end = Math.max(
      content.value.end,
      reach.value?.end ?? -Infinity,
      follow.value ? now.value : -Infinity,
    )
    const start = heldStart.value ?? freeStart.value
    const endAligned =
      unit === MINUTES_PER_DAY
        ? dayStart(end + after) + MINUTES_PER_DAY
        : alignCeil(end + after, unit)
    const maxMinutes = MAX_EXTENT_PX / ppm.value
    if (endAligned - start <= maxMinutes) return { start, end: endAligned }
    // keep total scrollWidth within browser layout limits at very fine (e.g. second) scales
    const step = Math.max(unit, Math.floor(maxMinutes / 4))
    const anchor = follow.value ? now.value : viewStart.value || content.value.start
    const clampedStart =
      heldStart.value ?? Math.max(start, alignFloor(anchor - maxMinutes / 2, step))
    const clampedEnd = Math.min(endAligned, alignCeil(clampedStart + maxMinutes, unit))
    return { start: clampedStart, end: Math.max(clampedStart + unit, clampedEnd) }
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
  const mounted = ref(false)
  /** True between a zoom change and its post-flush scroll sync. */
  const pendingScrollSync = ref(false)
  /** Last horizontal scroll position written programmatically, to ignore its async scroll event. */
  let expectedLeft: number | null = null
  /** True while `scrollToTime` is jumping to another time and detaching follow. */
  let jumping = false

  const link = createScrollLink('y')

  function writeScrollLeft(el: HTMLElement, target: number) {
    pendingScrollSync.value = false
    const width = o.viewWidth.value || el.clientWidth
    const max = Math.max(0, totalWidth.value - width)
    const clamped = Math.min(Math.max(0, Math.round(target)), max)
    if (Math.abs(el.scrollLeft - clamped) >= 1) {
      expectedLeft = clamped
      el.scrollLeft = clamped
    }
    const actual = scrollPositionOf(el).left
    if (expectedLeft != null) expectedLeft = actual
    scrollLeft.value = actual
  }

  function alignFollow() {
    if (!follow.value) return
    viewStart.value = now.value - followAnchor.value / ppm.value
    const el = o.chart.value
    if (!el) return
    writeScrollLeft(el, (viewStart.value - origin.value) * ppm.value)
  }

  function onChartScroll() {
    const el = o.chart.value!
    const body = o.tableBody.value
    pendingScrollSync.value = false
    // iOS reports positions past either end while the content bounces back
    const { top, left } = scrollPositionOf(el)
    const baseline = expectedLeft ?? scrollLeft.value
    const horizontalDelta = Math.abs(left - baseline)
    if (expectedLeft != null && horizontalDelta <= 2) expectedLeft = null
    else if (horizontalDelta > 2) {
      expectedLeft = null
      if (follow.value) follow.value = false
    }
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
    // without a finger it is filled right away, but only near the start: a
    // scrollbar thumb dragged there would jump back under the pointer
    else if (left < 2 * width) growBefore()
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
      if (follow.value) viewStart.value = now.value - followAnchor.value / ppm.value
      writeScrollLeft(el, (viewStart.value - origin.value) * ppm.value)
    },
    { flush: 'post' },
  )

  // keep the current viewport anchored in extent when follow turns off in place
  watch(
    follow,
    (on, was) => {
      if (was && !on && !jumping && !o.range()) {
        const width = o.viewWidth.value || 800
        keep(viewStart.value, Math.max(now.value, viewStart.value + width / ppm.value))
      }
    },
    { flush: 'sync' },
  )

  watch(
    follow,
    (on) => {
      if (on) {
        fitPending = false
        alignFollow()
      }
    },
    { flush: 'post' },
  )

  watch(
    [now, () => o.viewWidth.value],
    () => {
      if (follow.value && !touch.active.value) alignFollow()
    },
    { flush: 'post' },
  )

  function measureScrollbar() {
    const el = o.chart.value
    if (el) scrollbar.value = el.offsetHeight - el.clientHeight
  }

  function scrollToTime(at: number, offset = 48) {
    if (follow.value) {
      jumping = true
      follow.value = false
      jumping = false
    }
    // start the view on a whole header cell, so its label isn't cut at the edge
    const target = at - offset / ppm.value
    viewStart.value = unitStart(level.value.bottom, target, o.weekStart.value, headerStep.value)
    if (!o.range()) keep(viewStart.value, viewStart.value + o.viewWidth.value / ppm.value)
    const el = o.chart.value
    if (!el) return
    writeScrollLeft(el, (viewStart.value - origin.value) * ppm.value)
  }

  function fit(span?: [GanttTime, GanttTime]) {
    const width =
      o.fitWidth() ||
      o.chart.value?.clientWidth ||
      o.chart.value?.getBoundingClientRect().width ||
      0
    if (!width) {
      pendingFitRange = span ?? null
      return
    }
    pendingFitRange = null
    if (span) {
      const from = parseTime(span[0])
      const to = parseTime(span[1])
      if (!from || !to) return
      const start = from.dateOnly ? dayStart(from.at) : from.at
      const rawEnd = to.dateOnly ? dayStart(to.at) + MINUTES_PER_DAY : to.at
      let end = rawEnd
      if (end <= start) {
        const startMs = instantOf(span[0])
        const endMs = instantOf(span[1])
        if (startMs != null && endMs != null && endMs > startMs)
          end = start + (endMs - startMs) / 60_000
      }
      const minutes = end - start
      if (minutes <= 0) return
      fitPending = false
      const prevDayWidth = dayWidth.value
      const prevOrigin = origin.value
      const prevTotalWidth = totalWidth.value
      const followingLive =
        follow.value && Math.abs(rawEnd - now.value) <= Math.max(1, minutes * 0.15)
      const targetWidth = followingLive
        ? Math.max(120, followAnchor.value)
        : Math.max(120, width - 32)
      dayWidth.value = Math.min(
        DAY_WIDTH_RANGE[1],
        Math.max(DAY_WIDTH_RANGE[0], (targetWidth / minutes) * MINUTES_PER_DAY),
      )
      if (followingLive) {
        viewStart.value = now.value - followAnchor.value / ppm.value
        const layoutChanged =
          dayWidth.value !== prevDayWidth ||
          origin.value !== prevOrigin ||
          totalWidth.value !== prevTotalWidth
        if (layoutChanged) pendingScrollSync.value = true
        else alignFollow()
      } else {
        if (follow.value) {
          jumping = true
          follow.value = false
          jumping = false
        }
        const pad = Math.max(0, (width - minutes * ppm.value) / 2)
        viewStart.value = start - pad / ppm.value
        if (!o.range()) keep(viewStart.value, viewStart.value + width / ppm.value)
        const layoutChanged =
          dayWidth.value !== prevDayWidth ||
          origin.value !== prevOrigin ||
          totalWidth.value !== prevTotalWidth
        if (layoutChanged) pendingScrollSync.value = true
        else {
          const el = o.chart.value
          if (el) writeScrollLeft(el, (viewStart.value - origin.value) * ppm.value)
        }
      }
      return
    }
    fitPending = false
    const prevDayWidth = dayWidth.value
    const current = content.value
    const spanMinutes = current.end - current.start
    if (current.timed && spanMinutes > 0 && spanMinutes < MINUTES_PER_DAY) {
      const minutes = Math.max(1 / 60, spanMinutes)
      dayWidth.value = Math.min(
        DAY_WIDTH_RANGE[1],
        Math.max(DAY_WIDTH_RANGE[0], (Math.max(120, width - 96) / minutes) * MINUTES_PER_DAY),
      )
    } else {
      const days = Math.max(1, spanMinutes / MINUTES_PER_DAY)
      dayWidth.value = Math.min(FIT_MAX, Math.max(DAY_WIDTH_RANGE[0], (width - 96) / days))
    }
    if (dayWidth.value !== prevDayWidth) pendingScrollSync.value = true
    scrollToTime(current.start)
  }

  onMounted(() => {
    coarse.value = window.matchMedia?.('(any-pointer: coarse)').matches ?? false
    measureScrollbar()
    if (follow.value) alignFollow()
    else scrollToTime(content.value.start)
    mounted.value = true
  })

  /** Fits the content once the timeline has a width, unless a `scale` or `follow` was given. */
  function fitWhenSized() {
    if (!o.fitWidth() || !o.viewWidth.value) return
    if (pendingFitRange) {
      fitPending = false
      fit(pendingFitRange)
      return
    }
    if (!fitPending) return
    fitPending = false
    if (follow.value) alignFollow()
    else fit()
  }

  // Drag-to-pan (used in readonly mode) -------------------------------------------

  const panning = ref(false)
  let panned = false
  let stopPanListeners: (() => void) | null = null

  function startPan(event: PointerEvent) {
    if (event.button !== 0 || event.pointerType === 'touch') return
    if ((event.target as Element | null)?.closest('button, a, input, textarea, select')) return
    const el = o.chart.value
    if (!el) return
    stopPanListeners?.()
    const startX = event.clientX
    const pointerId = event.pointerId
    let anchorX = startX
    let anchorTime = origin.value + scrollPositionOf(el).left / ppm.value
    let active = false
    let captured = false
    let unlock: (() => void) | null = null
    panned = false
    if (typeof document !== 'undefined') document.addEventListener('selectstart', preventSelect)

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX
      if (!active) {
        if (Math.abs(dx) < 3) return
        active = true
        panned = true
        panning.value = true
        pendingScrollSync.value = false
        unlock = lockSelection('grabbing')
        try {
          el.setPointerCapture?.(pointerId)
          captured = true
        } catch {
          // synthetic PointerEvents in tests have no active pointer to capture
        }
        if (follow.value) follow.value = false
      }
      e.preventDefault()
      const wanted = (anchorTime - origin.value) * ppm.value - (e.clientX - anchorX)
      const width = o.viewWidth.value || el.clientWidth
      const max = Math.max(0, totalWidth.value - width)
      const clamped = Math.min(Math.max(0, Math.round(wanted)), max)
      el.scrollLeft = clamped
      const actual = scrollPositionOf(el).left
      scrollLeft.value = actual
      viewStart.value = origin.value + actual / ppm.value
      grow()
      if (clamped !== Math.round(wanted)) {
        anchorX = e.clientX
        anchorTime = viewStart.value
      }
    }
    const cleanup = () => {
      if (typeof document !== 'undefined')
        document.removeEventListener('selectstart', preventSelect)
      unlock?.()
      unlock = null
      if (captured) {
        captured = false
        try {
          if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId)
        } catch {
          // pointer capture already ended
        }
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stopPanListeners = null
    }
    const onUp = () => {
      cleanup()
      if (active) {
        panning.value = false
        setTimeout(() => (panned = false), 0)
      }
    }
    stopPanListeners = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  onBeforeUnmount(() => stopPanListeners?.())

  const wasPanned = () => panned

  // Zoom --------------------------------------------------------------------------

  /** Changes the day width, keeping the time under `anchor` (or `now` while following) in place. */
  function zoomTo(width: number, anchor = o.viewWidth.value / 2) {
    const next = Math.min(DAY_WIDTH_RANGE[1], Math.max(DAY_WIDTH_RANGE[0], width))
    const at = follow.value ? now.value : viewStart.value + anchor / ppm.value
    const pin = follow.value ? followAnchor.value : anchor
    pendingScrollSync.value = true
    dayWidth.value = next
    viewStart.value = at - pin / ppm.value
    // what was scrolled past at the old zoom could be very wide at the new one
    if (reach.value && !o.range()) {
      reach.value = null
      keep(viewStart.value, viewStart.value + o.viewWidth.value / ppm.value)
    }
    // a pinch moves the scroll position anyway, so re-lock to the new extent start
    if (heldStart.value != null) {
      heldStart.value = null
      heldStart.value = extent.value.start
    }
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const rect = o.chart.value!.getBoundingClientRect()
      zoomTo(dayWidth.value * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left)
      return
    }
    if (
      follow.value &&
      (Math.abs(event.deltaX) > 0 || (event.shiftKey && Math.abs(event.deltaY) > 0))
    ) {
      follow.value = false
    }
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

  /**
   * The time in view, with some room either side, but never past either end:
   * what is drawn past the end would widen the timeline, and scrolling on
   * would draw more, so a fixed `range` would scroll on for ever.
   */
  const timeWindow = computed(() => ({
    start: Math.max(extent.value.start, origin.value + (scrollLeft.value - OVERSCAN_X) / ppm.value),
    end: Math.min(
      extent.value.end,
      origin.value + (scrollLeft.value + (o.viewWidth.value || 800) + OVERSCAN_X) / ppm.value,
    ),
  }))

  function cells(unit: TimeUnit, step = 1): HeaderCell[] {
    const { start, end } = timeWindow.value
    return unitsBetween(unit, start, end, o.weekStart.value, step).map((cell) => ({
      key: cell.start,
      end: cell.end,
      left: xOf(cell.start),
      // a cell that runs past the end stops there
      width: (Math.min(cell.end, extent.value.end) - cell.start) * ppm.value,
      label: unitLabel(unit, cell.start, o.messages.value, dayWidth.value),
    }))
  }

  const headerStep = computed(() => headerStepFor(level.value.bottom, dayWidth.value))
  const topCells = computed(() => cells(level.value.top))
  const bottomCells = computed(() => cells(level.value.bottom, headerStep.value))

  /** Days off, shaded; at sub-day levels the hours outside work too. */
  const shaded = computed(() => {
    if (dayWidth.value < 8) return []
    const { start, end } = timeWindow.value
    const subDay =
      level.value.name === 'hour' || level.value.name === 'minute' || level.value.name === 'second'
    return offTime(o.calendar.value, start, end, subDay).map((range) => ({
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

  function scrollToDate(date: GanttTime) {
    const parsed = parseTime(date)
    if (parsed) scrollToTime(parsed.at)
  }

  function scrollToToday() {
    if (follow.value) alignFollow()
    else scrollToTime(now.value, o.viewWidth.value / 3)
  }

  /** Converts a public `GanttTime` (date string or Unix ms) to canvas x, in px. */
  function timeToX(time: GanttTime): number | null {
    const parsed = parseTime(time)
    return parsed ? xOf(parsed.at) : null
  }

  /** Converts a canvas x (in px) to a Unix timestamp in ms. */
  const xToTime = (x: number): number => toTimestamp(origin.value + x / ppm.value)

  const viewport = computed<GanttViewport>(() => {
    const el = o.chart.value
    const width = o.viewWidth.value || el?.clientWidth || el?.getBoundingClientRect().width || 0
    const projected = Math.min(
      Math.max(0, (viewStart.value - origin.value) * ppm.value),
      Math.max(0, totalWidth.value - width),
    )
    const useLogical = pendingScrollSync.value || !el || el.scrollWidth <= 0
    const leftPx = useLogical ? projected : scrollLeft.value
    const startAt = origin.value + leftPx / ppm.value
    const endAt = startAt + width / ppm.value
    return {
      start: toTimestamp(startAt),
      end: toTimestamp(endAt),
      scale: level.value.name,
      dayWidth: dayWidth.value,
      ppm: ppm.value,
      scrollLeft: leftPx,
      width,
      origin: toTimestamp(origin.value),
    }
  })

  const getViewport = (): GanttViewport => ({ ...viewport.value })

  let lastViewport: GanttViewport | null = null
  watch(
    [mounted, viewport],
    ([ready, next]) => {
      if (!ready || !o.onViewportChange || next.width <= 0) return
      if (
        lastViewport &&
        lastViewport.start === next.start &&
        lastViewport.end === next.end &&
        lastViewport.scale === next.scale &&
        lastViewport.dayWidth === next.dayWidth &&
        Math.round(lastViewport.scrollLeft) === Math.round(next.scrollLeft) &&
        Math.round(lastViewport.width) === Math.round(next.width) &&
        lastViewport.origin === next.origin
      )
        return
      lastViewport = next
      o.onViewportChange(next)
    },
    { flush: 'post' },
  )

  return {
    dayWidth,
    level,
    ppm,
    now,
    extent,
    origin,
    totalWidth,
    xOf,
    timeToX,
    xToTime,
    contentX,
    viewport,
    getViewport,
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
    panning,
    startPan,
    wasPanned,
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
