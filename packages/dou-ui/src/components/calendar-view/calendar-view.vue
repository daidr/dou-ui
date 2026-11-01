<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '@dou-ui/icons'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  triggerRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { holdPointer } from '../../utils/pointer'
import type { PointerHold } from '../../utils/pointer'
import { useLocale } from '../config-provider/use-config'
import { DouContextMenu } from '../context-menu'
import { addDays, addMonths, parts, today, toDateString, weekday } from '../date-picker/date'
import { DouDropdownItem } from '../dropdown'
import { DouIcon } from '../icon'
import { DouSegmentedControl } from '../segmented-control'
import type {
  CalendarChange,
  CalendarDay,
  CalendarEvent,
  CalendarMenuItem,
  CalendarMenuTarget,
  CalendarMove,
  CalendarRange,
  CalendarViewExpose,
  CalendarViewMode,
  CalendarViewProps,
  CalendarViewSlots,
} from './calendar-view'
import {
  dayIndex,
  endOf,
  formatStamp,
  formatTime,
  moveEvent,
  sameTime,
  stampsOf,
  toStamp,
} from './editing'
import TimeGrid from './time-grid.vue'
import { segmentOn, spanOf } from './time-layout'
import type { EventSpan } from './time-layout'

defineOptions({ name: 'DouCalendarView' })

const props = withDefaults(defineProps<CalendarViewProps>(), {
  maxEvents: 3,
  hours: () => [0, 24],
  scrollTime: '08:00',
  snap: 15,
  menu: true,
})
const model = defineModel<string | null>()
const month = defineModel<string>('month')
const view = defineModel<CalendarViewMode>('view', { default: 'month' })
const events = defineModel<CalendarEvent[]>('events', { default: () => [] })
const emit = defineEmits<{
  select: [date: string]
  eventClick: [event: CalendarEvent]
  timeClick: [start: string]
  change: [change: CalendarChange]
  create: [range: CalendarRange]
  eventContextmenu: [event: CalendarEvent, nativeEvent: MouseEvent]
}>()
const slots = defineSlots<CalendarViewSlots>()

const ns = useNamespace('calendar-view')
const { t, locale } = useLocale()

const weekStart = computed(() => props.weekStart ?? locale.value.region.weekStart)
const todayValue = today()

/** The day the keyboard is on; its month is the one shown. */
const cursor = ref(model.value || (month.value ? `${month.value}-01` : todayValue))
const shown = computed(() => cursor.value.slice(0, 7))

watch(shown, (value) => {
  if (value !== month.value) month.value = value
})
watch(month, (value) => {
  if (value && value !== shown.value) cursor.value = `${value}-01`
})
watch(model, (value) => {
  if (value && value.slice(0, 7) !== shown.value) cursor.value = value
})

const asDate = (date: string) => {
  const { year, month: m, day } = parts(date)
  const value = new Date(Date.UTC(2000, m - 1, day))
  value.setUTCFullYear(year)
  return value
}
const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value.name, { timeZone: 'UTC', ...options })

const fullDate = computed(() => formatter({ dateStyle: 'full' }))
const title = computed(() => {
  if (view.value === 'day') return fullDate.value.format(asDate(cursor.value))
  if (view.value === 'week') {
    // Composed by hand: some locales fall back to all-numeric dates in formatRange.
    const first = weekDays.value[0]!.date
    const last = weekDays.value.at(-1)!.date
    const full = formatter({ year: 'numeric', month: 'short', day: 'numeric' })
    const end =
      first.slice(0, 4) === last.slice(0, 4) ? formatter({ month: 'short', day: 'numeric' }) : full
    return `${full.format(asDate(first))} – ${end.format(asDate(last))}`
  }
  return formatter({ year: 'numeric', month: 'long' }).format(asDate(`${shown.value}-01`))
})
const weekdays = computed(() => {
  const short = formatter({ weekday: 'short' })
  const long = formatter({ weekday: 'long' })
  // 2024-01-07 is a Sunday.
  return Array.from({ length: 7 }, (_, index) => {
    const date = asDate(toDateString(2024, 1, 7 + ((weekStart.value + index) % 7)))
    return { short: short.format(date), long: long.format(date) }
  })
})

type Surface = 'time' | 'day'
interface Drag {
  /** `press` is a finger resting where nothing can be dragged: letting go opens the menu. */
  kind: 'move' | 'resize' | 'create' | 'press'
  surface: Surface
  event: CalendarEvent | null
  span: EventSpan | null
  /** Where the press began: the day and, on the time axis, minutes since midnight. */
  origin: { date: string; minutes: number }
  pointerId: number
  touch: boolean
  x0: number
  y0: number
  x: number
  y: number
  started: boolean
  /** The event at its new time, while moving or resizing. */
  draft: CalendarEvent | null
  /** The stretch being drawn, while creating. */
  range: CalendarRange | null
  refusal: string | null
  /** What a resting finger opens the menu on. */
  target: CalendarMenuTarget | null
}

const drag = shallowRef<Drag | null>(null)
const dragged = computed(() => (drag.value?.started && drag.value.draft) || null)
const drawing = computed(() => (drag.value?.started && drag.value.range) || null)
const refused = computed(() => !!(drag.value?.started && drag.value.refusal))

/** The events as shown: the one being dragged at its new time. */
const shownEvents = computed(() => {
  const d = drag.value
  if (!d?.started || !d.event || !d.draft) return events.value
  return events.value.map((event) => (event === d.event ? d.draft! : event))
})

/** Where each event falls; events whose `start` can't be read are left out. */
const spans = computed(() => {
  const map = new Map<CalendarEvent, EventSpan>()
  for (const event of shownEvents.value) {
    const span = spanOf(event)
    if (span) map.set(event, span)
  }
  return map
})

// Events that can't be read are left out; say so once per event while developing.
const warned = new WeakSet<CalendarEvent>()
watch(
  events,
  (list) => {
    // the app's bundler replaces this, as for Vue's own warnings
    if (process.env.NODE_ENV === 'production') return
    for (const event of list) {
      if (spans.value.has(event) || warned.has(event)) continue
      warned.add(event)
      console.warn(
        `[dou-ui] CalendarView event "${event.id}" has a start that can't be read: "${event.start}". Use YYYY-MM-DD or YYYY-MM-DD HH:mm.`,
      )
    }
  },
  { immediate: true },
)

/**
 * Events that run over several days first, so their bars tend to line up
 * from day to day, then the other all-day ones, then timed ones by when
 * they start on the day.
 */
const startOn = (event: CalendarEvent, date: string) => {
  // the event being dragged comes first, so it never folds into "+N"
  if (event === dragged.value) return -3
  const span = spans.value.get(event)!
  if (span.from !== span.to) return -2
  return span.start === null ? -1 : segmentOn(span, date).start
}

/** Events by day, a span listed on every day it covers. */
const byDay = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const span of spans.value.values()) {
    for (let date = span.from, guard = 0; date <= span.to && guard < 366; guard++) {
      const list = map.get(date) ?? []
      list.push(span.event)
      map.set(date, list)
      date = addDays(date, 1)
    }
  }
  for (const [date, list] of map)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the lists built above
    list.sort((a, b) => startOn(a, date) - startOn(b, date))
  return map
})

const weeks = computed<CalendarDay[][]>(() => {
  const first = `${shown.value}-01`
  const offset = (weekday(first) - weekStart.value + 7) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 6 }, (_row, row) =>
    Array.from({ length: 7 }, (_column, column) => {
      const date = addDays(start, row * 7 + column)
      return {
        date,
        day: parts(date).day,
        outside: date.slice(0, 7) !== shown.value,
        today: date === todayValue,
        selected: date === model.value,
        disabled: !!props.disabledDate?.(date),
        events: byDay.value.get(date) ?? [],
      }
    }),
  )
})

const dayOf = (date: string): CalendarDay => ({
  date,
  day: parts(date).day,
  outside: false,
  today: date === todayValue,
  selected: date === model.value,
  disabled: !!props.disabledDate?.(date),
  events: byDay.value.get(date) ?? [],
})

/** The days on the time axis: the cursor's week, or the cursor alone. */
const weekDays = computed<CalendarDay[]>(() => {
  if (view.value === 'day') return [dayOf(cursor.value)]
  const start = addDays(cursor.value, -((weekday(cursor.value) - weekStart.value + 7) % 7))
  return Array.from({ length: 7 }, (_, index) => dayOf(addDays(start, index)))
})

const viewOptions = computed(() =>
  (props.views ?? []).map((value) => ({ value, label: t(`calendarView.${value}`) })),
)

/** A timed event starts with its time in a month cell, on its first day. */
const monthTime = (event: CalendarEvent, date: string) => {
  const span = spans.value.get(event)!
  if (span.start === null || span.from !== date) return ''
  return `${String(Math.floor(span.start / 60)).padStart(2, '0')}:${String(span.start % 60).padStart(2, '0')}`
}

const isStart = (event: CalendarEvent, date: string) => spans.value.get(event)!.from === date
/** Whether the day opens a row, where a running span shows its title again. */
const weekStarts = (date: string) => (weekday(date) - weekStart.value + 7) % 7 === 0
const isEnd = (event: CalendarEvent, date: string) => spans.value.get(event)!.to <= date

/** Whether a day is inside the stretch being drawn. */
const inDrawing = (date: string) =>
  !!drawing.value && drawing.value.start <= date && date <= drawing.value.end.slice(0, 10)
/** An all-day event can have its last day dragged, from the day it ends on. */
const resizable = (event: CalendarEvent, date: string) =>
  !!props.editable &&
  !event.locked &&
  spans.value.get(event)!.start === null &&
  spans.value.get(event)!.to === date
const keyShortcuts = 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Delete'

/* choosing and moving */

const gridRef = useTemplateRef<HTMLElement>('grid')

const rootRef = useTemplateRef<HTMLElement>('root')

async function focusCursor() {
  await nextTick()
  ;(gridRef.value ?? rootRef.value)
    ?.querySelector<HTMLElement>(`[data-date="${cursor.value}"]`)
    ?.focus({ preventScroll: true })
}

function choose(day: CalendarDay) {
  if (day.disabled) return
  cursor.value = day.date
  model.value = day.date
  emit('select', day.date)
}

function step(direction: 1 | -1) {
  if (view.value === 'week') cursor.value = addDays(cursor.value, direction * 7)
  else if (view.value === 'day') cursor.value = addDays(cursor.value, direction)
  else cursor.value = addMonths(cursor.value, direction)
}

const stepLabels = computed(() =>
  view.value === 'week'
    ? [t('calendarView.prevWeek'), t('calendarView.nextWeek')]
    : view.value === 'day'
      ? [t('calendarView.prevDay'), t('calendarView.nextDay')]
      : [t('datePicker.prevMonth'), t('datePicker.nextMonth')],
)

function goToday() {
  cursor.value = todayValue
}

/** Left and right move between the days at the head of the week view. */
function onTimeKeydown(event: KeyboardEvent) {
  if (view.value !== 'week' || !(event.target as HTMLElement).dataset.date) return
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  const days = weekDays.value
  const index = days.findIndex((day) => day.date === cursor.value) + move
  if (index < 0 || index >= days.length) return
  cursor.value = days[index]!.date
  void focusCursor()
}

function onKeydown(event: KeyboardEvent) {
  const date = cursor.value
  const column = (weekday(date) - weekStart.value + 7) % 7
  const keys: Record<string, () => string> = {
    ArrowLeft: () => addDays(date, -1),
    ArrowRight: () => addDays(date, 1),
    ArrowUp: () => addDays(date, -7),
    ArrowDown: () => addDays(date, 7),
    Home: () => addDays(date, -column),
    End: () => addDays(date, 6 - column),
    PageUp: () => addMonths(date, event.shiftKey ? -12 : -1),
    PageDown: () => addMonths(date, event.shiftKey ? 12 : 1),
  }
  const next = keys[event.key]?.()
  if (next) {
    event.preventDefault()
    cursor.value = next
    void focusCursor()
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const day = weeks.value.flat().find((cell) => cell.date === date)
    if (day) choose(day)
  }
}

function dayLabel(day: CalendarDay) {
  const date = fullDate.value.format(asDate(day.date))
  if (!day.events.length) return date
  return t('calendarView.dayWithEvents', { date, count: day.events.length })
}

/* editing: dragging, drawing, the menu and the keys */

const LONG_PRESS = 300
const THRESHOLD = { mouse: 3, touch: 6 }
/** How close to the top or bottom of the time axis a drag starts scrolling it, in px. */
const EDGE = 32

const live = ref('')
function announce(text: string) {
  // the same text twice in a row is read again
  live.value = live.value === text ? `${text} ` : text
}

let hold: PointerHold | null = null
let pressTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0
/** Beside the pointer while dragging: the new time, or why it can't go there. */
const tip = computed(() => {
  const d = drag.value
  if (!d?.started || d.kind === 'press') return ''
  if (d.refusal) return d.refusal
  if (d.draft) return rangeText(d.draft)
  return d.range ? rangeText({ id: '', title: '', ...d.range }) : ''
})

/** Below the pointer, on its left once past the middle of the window so it stays in view. */
const tipStyle = computed(() => {
  const d = drag.value
  if (!d) return {}
  const left = typeof window !== 'undefined' && d.x > window.innerWidth / 2
  return {
    left: `${left ? d.x - 12 : d.x + 12}px`,
    top: `${d.y + 16}px`,
    transform: left ? 'translateX(-100%)' : undefined,
  }
})

/** A drag ended a moment ago: the click that follows it is not a click. */
let swallow = false
/** When a finger last went down; the browser's own long-press menu is ignored after it. */
let touchedAt = 0

const byId = (id: string | undefined) => events.value.find((event) => event.id === id)
const canEdit = (event: CalendarEvent) => !!props.editable && !event.locked

const dayFormat = computed(() => formatter({ month: 'short', day: 'numeric' }))
const clock = computed(() =>
  formatter({
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: /A/.test(locale.value.region.time) ? 'h12' : 'h23',
  }),
)
const timeText = (minutes: number) => clock.value.format(new Date(Date.UTC(2000, 0, 1, 0, minutes)))

/** When an event takes place, as read out after a change. */
function rangeText(event: CalendarEvent) {
  const span = spanOf(event)
  if (!span) return ''
  const from = dayFormat.value.format(asDate(span.from))
  const to = dayFormat.value.format(asDate(span.to))
  if (span.start === null) return span.from === span.to ? from : `${from} – ${to}`
  if (span.from === span.to) return `${from} ${timeText(span.start)}–${timeText(span.end!)}`
  return `${from} ${timeText(span.start)} – ${to} ${timeText(span.end!)}`
}

/**
 * The day and time under a point. The nearest column or day is taken when
 * the point is off to the side, so a drag past the edge stays on the last
 * day; on the time axis the time is kept inside the hours shown.
 */
function pointAt(surface: Surface, x: number, y: number) {
  const cells = rootRef.value?.querySelectorAll<HTMLElement>(`[data-drop="${surface}"]`) ?? []
  let best: { cell: HTMLElement; rect: DOMRect } | null = null
  let distance = Infinity
  for (const cell of cells) {
    const rect = cell.getBoundingClientRect()
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = surface === 'time' ? 0 : Math.max(rect.top - y, 0, y - rect.bottom)
    if (dx * dx + dy * dy < distance) {
      distance = dx * dx + dy * dy
      best = { cell, rect }
    }
  }
  if (!best) return null
  const date = best.cell.dataset.date!
  if (surface === 'day') return { date, minutes: 0 }
  const from = Number(best.cell.dataset.from)
  const to = Number(best.cell.dataset.to)
  const ratio = best.rect.height ? (y - best.rect.top) / best.rect.height : 0
  return { date, minutes: Math.min(to, Math.max(from, from + ratio * (to - from))) }
}

/** `null` when the change may be made, else why not. */
function refusalOf(kind: CalendarMove['kind'], event: CalendarEvent | null, next: CalendarRange) {
  const span = spanOf({ id: '', title: '', start: next.start, end: next.end })
  if (span && props.disabledDate) {
    for (let date = span.from, guard = 0; date <= span.to && guard < 366; guard++) {
      if (props.disabledDate(date)) return t('calendarView.disabledDay')
      date = addDays(date, 1)
    }
  }
  if (!props.canMove) return null
  const answer = props.canMove({ kind, event, start: next.start, end: next.end })
  if (answer === true) return null
  return typeof answer === 'string' && answer ? answer : t('calendarView.refused')
}

const roundTo = (value: number, by: number) => Math.round(value / by) * by
const floorTo = (value: number, by: number) => Math.floor(value / by) * by

/** Work out what the drag would change, with the pointer where it is now. */
function update(d: Drag) {
  const point = pointAt(d.surface, d.x, d.y)
  if (!point || d.kind === 'press') return
  const snap = Math.max(1, Math.round(props.snap))
  let draft: CalendarEvent | null = null
  let range: CalendarRange | null = null
  if (d.surface === 'time') {
    const now = toStamp(point.date, point.minutes)
    const origin = toStamp(d.origin.date, d.origin.minutes)
    if (d.kind === 'create') {
      const a = floorTo(origin, snap)
      const b = floorTo(now, snap)
      range = { start: formatStamp(Math.min(a, b)), end: formatStamp(Math.max(a, b) + snap) }
    } else {
      const { start } = stampsOf(d.span!)
      if (d.kind === 'move') {
        const next = roundTo(start + now - origin, snap)
        draft = moveEvent(d.event!, d.span!, { minutes: next - start })
      } else {
        draft = { ...d.event!, end: formatStamp(Math.max(start + snap, roundTo(now, snap))) }
      }
    }
  } else {
    const days = dayIndex(point.date) - dayIndex(d.origin.date)
    if (d.kind === 'create') {
      const [a, b] = [d.origin.date, point.date]
      range = a <= b ? { start: a, end: b } : { start: b, end: a }
    } else if (d.kind === 'move') {
      draft = moveEvent(d.event!, d.span!, { days })
    } else {
      draft = { ...d.event!, end: point.date < d.span!.from ? d.span!.from : point.date }
    }
  }
  if (draft) {
    if (d.draft && sameTime(d.draft, draft)) return
    d.draft = draft
    d.refusal = sameTime(draft, d.event!)
      ? null
      : refusalOf(d.kind, d.event, { start: draft.start, end: endOf(draft) })
  } else if (range) {
    if (d.range?.start === range.start && d.range.end === range.end) return
    d.range = range
    d.refusal = refusalOf('create', null, range)
  }
  triggerRef(drag)
}

/** The menu target under a pointer or a key press. */
function targetOf(el: HTMLElement, x: number, y: number): CalendarMenuTarget | null {
  const chip = el.closest<HTMLElement>('[data-event-id]')
  const event = chip && byId(chip.dataset.eventId)
  if (event) return { kind: 'event', event }
  const cell = el.closest<HTMLElement>('[data-drop]')
  if (!cell) return null
  if (cell.dataset.drop === 'day') return { kind: 'day', date: cell.dataset.date! }
  const point = pointAt('time', x, y)
  if (!point) return null
  const minutes = Math.min(
    floorTo(point.minutes, Math.max(1, props.snap)),
    Number(cell.dataset.to) - props.snap,
  )
  return { kind: 'time', start: `${point.date} ${formatTime(Math.max(0, minutes))}` }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || drag.value) return
  const el = event.target as HTMLElement
  const touch = event.pointerType !== 'mouse'
  if (touch) touchedAt = Date.now()
  const cell = el.closest<HTMLElement>('[data-drop]')
  if (!cell) return
  const surface = cell.dataset.drop as Surface
  const chip = el.closest<HTMLElement>('[data-event-id]')
  const item = chip ? byId(chip.dataset.eventId) : undefined
  let kind: Drag['kind']
  if (item) {
    const span = spans.value.get(item)
    if (!span) return
    if (!canEdit(item)) kind = 'press'
    else if (el.closest('[data-resize]')) kind = 'resize'
    else kind = 'move'
  } else {
    if (chip || el.closest('button, a, input')) return
    if (cell.matches('.is-disabled')) kind = 'press'
    else kind = props.editable ? 'create' : 'press'
  }
  // a mouse has its own menu button; only a finger needs the resting press
  if (kind === 'press' && !touch) return
  const origin = pointAt(surface, event.clientX, event.clientY)
  if (!origin) return
  drag.value = {
    kind,
    surface,
    event: item ?? null,
    span: item ? spans.value.get(item)! : null,
    origin,
    pointerId: event.pointerId,
    touch,
    x0: event.clientX,
    y0: event.clientY,
    x: event.clientX,
    y: event.clientY,
    started: false,
    draft: null,
    range: null,
    refusal: null,
    target: targetOf(el, event.clientX, event.clientY),
  }
  hold = holdPointer(event, rootRef.value)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', stopDrag)
  window.addEventListener('keydown', onDragKey, true)
  // a finger picks an event up after a short rest; moving sooner scrolls instead
  if (touch) {
    const d = drag.value
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
  if (d.kind !== 'press') {
    update(d)
    if (d.surface === 'time') frame = requestAnimationFrame(autoScroll)
  }
  triggerRef(drag)
}

function onDragMove(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  d.x = event.clientX
  d.y = event.clientY
  const far = Math.hypot(d.x - d.x0, d.y - d.y0) > THRESHOLD[d.touch ? 'touch' : 'mouse']
  if (!d.started) {
    // a finger that moves before resting scrolls the page
    if (d.touch) return void (far && stopDrag())
    if (far) begin(d)
    return
  }
  if (d.kind === 'press') return
  update(d)
}

function onDragEnd(event: PointerEvent) {
  const d = drag.value
  if (!d || event.pointerId !== d.pointerId) return
  const still = Math.hypot(d.x - d.x0, d.y - d.y0) <= THRESHOLD.touch
  stopDrag()
  if (!d.started) return
  swallow = true
  setTimeout(() => (swallow = false))
  // a finger rested and let go without moving: the menu
  if (d.touch && still) {
    if (d.target) showMenu(d.target, event.clientX, event.clientY)
    return
  }
  if (d.refusal) return announce(d.refusal)
  if (d.kind === 'create' && d.range) emit('create', { ...d.range })
  else if ((d.kind === 'move' || d.kind === 'resize') && d.draft && !sameTime(d.draft, d.event!))
    commit(d.kind, d.event!, d.draft)
}

function stopDrag() {
  clearTimeout(pressTimer)
  cancelAnimationFrame(frame)
  hold?.release()
  hold = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', stopDrag)
  window.removeEventListener('keydown', onDragKey, true)
  drag.value = null
}

function onDragKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  if (drag.value?.started) {
    swallow = true
    setTimeout(() => (swallow = false))
  }
  stopDrag()
}

/** Auto-scroll speed in px per frame, `gap` px from the edge. */
const speed = (gap: number) => (gap < EDGE ? Math.ceil(((EDGE - gap) / EDGE) * 12) : 0)

/** Scrolls the time axis while a drag rests near its top or bottom. */
function autoScroll() {
  const d = drag.value
  const el = rootRef.value?.querySelector<HTMLElement>(`.${ns.e('scroller')}`)
  if (!d?.started || !el) return
  const rect = el.getBoundingClientRect()
  const dy = speed(d.y - rect.top) ? -speed(d.y - rect.top) : speed(rect.bottom - d.y)
  if (dy) {
    const before = el.scrollTop
    el.scrollTop += dy
    if (el.scrollTop !== before) update(d)
  }
  frame = requestAnimationFrame(autoScroll)
}

function onClickCapture(event: MouseEvent) {
  if (!swallow) return
  event.stopPropagation()
  event.preventDefault()
}

/** Writes the new version of an event, then keeps the keyboard and the view on it. */
function commit(kind: 'move' | 'resize', previous: CalendarEvent, next: CalendarEvent) {
  events.value = events.value.map((event) => (event === previous ? next : event))
  emit('change', { kind, event: next, previous })
  announce(t('calendarView.changed', { title: next.title, range: rangeText(next) }))
}

function remove(event: CalendarEvent) {
  events.value = events.value.filter((item) => item !== event)
  emit('change', { kind: 'remove', event })
  announce(t('calendarView.removed', { title: event.title }))
}

/* the menu */

const menuRef = useTemplateRef<InstanceType<typeof DouContextMenu>>('menu')
const menuOpen = ref(false)
const menuItems = shallowRef<CalendarMenuItem[]>([])
// shortcuts mean nothing without a keyboard
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Opens the menu for a target; `false` when it would be empty. */
function showMenu(target: CalendarMenuTarget, x: number, y: number) {
  const items = [...(props.contextMenu?.(target) ?? [])]
  if (props.menu && target.kind === 'event' && canEdit(target.event)) {
    items.push({
      key: '\0delete',
      label: t('calendarView.deleteEvent'),
      icon: TrashIcon,
      shortcut: 'Delete',
      tone: 'danger',
      divided: items.length > 0,
      run: () => remove(target.event),
    })
  }
  if (!items.length) return false
  menuItems.value = items
  menuRef.value?.open(x, y)
  return true
}

function onMenuSelect(key: unknown) {
  menuItems.value.find((item) => item.key === key)?.run()
}

function onContextmenu(event: MouseEvent) {
  // a finger's long press opens the menu itself, when it lets go
  if (Date.now() - touchedAt < 1000) return event.preventDefault()
  const target = targetOf(event.target as HTMLElement, event.clientX, event.clientY)
  if (!target) return
  if (target.kind === 'event') {
    emit('eventContextmenu', target.event, event)
    if (event.defaultPrevented) return
  }
  if (showMenu(target, event.clientX, event.clientY)) event.preventDefault()
}

/* keys on an event */

async function focusEvent(id: string) {
  await nextTick()
  rootRef.value?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`)?.focus()
}

/**
 * On a focused event: the menu key opens its menu, `Delete` removes it,
 * `Alt` with the arrows moves it and `Alt` + `Shift` with the arrows moves
 * its end. Left and right go by a day; up and down by `snap` on the time
 * axis, or by a week in the month.
 */
function onEventKeydown(event: KeyboardEvent) {
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-event-id]')
  const item = chip && byId(chip.dataset.eventId)
  if (!item) return
  const done = () => {
    event.preventDefault()
    event.stopPropagation()
  }
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    const rect = chip.getBoundingClientRect()
    if (showMenu({ kind: 'event', event: item }, rect.left, rect.bottom)) done()
    return
  }
  if (!canEdit(item)) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    done()
    remove(item)
    return
  }
  const span = spans.value.get(item)
  if (!event.altKey || !span) return
  const timed = span.start !== null
  const onAxis = timed && view.value !== 'month'
  const snap = Math.max(1, Math.round(props.snap))
  const keys: Record<string, { days?: number; minutes?: number }> = {
    ArrowLeft: { days: -1 },
    ArrowRight: { days: 1 },
    ArrowUp: onAxis ? { minutes: -snap } : view.value === 'month' ? { days: -7 } : {},
    ArrowDown: onAxis ? { minutes: snap } : view.value === 'month' ? { days: 7 } : {},
  }
  const by = keys[event.key]
  if (!by || (!by.days && !by.minutes)) return
  done()
  let next: CalendarEvent
  let kind: 'move' | 'resize' = 'move'
  if (event.shiftKey) {
    kind = 'resize'
    if (timed) {
      const { start, end } = stampsOf(span)
      const delta = (by.days ?? 0) * 24 * 60 + (by.minutes ?? 0)
      next = { ...item, end: formatStamp(Math.max(start + snap, end + delta)) }
    } else {
      const last = addDays(span.to, by.days ?? 0)
      next = { ...item, end: last < span.from ? span.from : last }
    }
  } else {
    next = moveEvent(item, span, by)
  }
  if (sameTime(next, item)) return
  const refusal = refusalOf(kind, item, { start: next.start, end: endOf(next) })
  if (refusal) return announce(refusal)
  commit(kind, item, next)
  const placed = spanOf(next)
  if (placed) cursor.value = kind === 'resize' ? placed.to : placed.from
  void focusEvent(next.id)
}

onBeforeUnmount(stopDrag)

defineExpose<CalendarViewExpose>({
  show: (date) => (cursor.value = date.length === 7 ? `${date}-01` : date),
  focus: () => void focusCursor(),
})
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.m(view),
      ns.is('editable', !!editable),
      ns.is('dragging', !!drag?.started && drag.kind !== 'press'),
      drag?.started && drag.kind !== 'press' ? `is-dragging-${drag.kind}` : '',
    ]"
    @pointerdown="onPointerDown"
    @contextmenu="onContextmenu"
    @click.capture="onClickCapture"
    @keydown.capture="onEventKeydown"
  >
    <div :class="ns.e('header')">
      <h2 :class="ns.e('title')" aria-live="polite">{{ title }}</h2>
      <div :class="ns.e('nav')">
        <slot name="extra" />
        <DouSegmentedControl
          v-if="viewOptions.length > 1"
          v-model="view"
          :options="viewOptions"
          size="sm"
        />
        <button type="button" :class="ns.e('today')" @click="goToday">
          {{ t('datePicker.today') }}
        </button>
        <button type="button" :class="ns.e('step')" :aria-label="stepLabels[0]" @click="step(-1)">
          <ChevronLeftIcon />
        </button>
        <button type="button" :class="ns.e('step')" :aria-label="stepLabels[1]" @click="step(1)">
          <ChevronRightIcon />
        </button>
      </div>
    </div>
    <TimeGrid
      v-if="view !== 'month'"
      :days="weekDays"
      :spans="spans"
      :hours="hours"
      :scroll-time="scrollTime"
      :cursor="cursor"
      :as-date="asDate"
      :editable="!!editable"
      :dragged="dragged"
      :refused="refused"
      :drawing="drawing"
      @choose="choose"
      @event-click="emit('eventClick', $event)"
      @time-click="emit('timeClick', $event)"
      @keydown="onTimeKeydown"
    >
      <template v-if="slots.event" #event="scope">
        <slot name="event" v-bind="scope" />
      </template>
    </TimeGrid>
    <div
      v-else
      ref="grid"
      role="grid"
      :class="ns.e('grid')"
      :aria-label="title"
      @keydown="onKeydown"
    >
      <div role="row" :class="ns.e('weekdays')">
        <div
          v-for="weekdayName in weekdays"
          :key="weekdayName.long"
          role="columnheader"
          :class="ns.e('weekday')"
          :aria-label="weekdayName.long"
        >
          {{ weekdayName.short }}
        </div>
      </div>
      <div v-for="(week, row) in weeks" :key="row" role="row" :class="ns.e('week')">
        <div
          v-for="day in week"
          :key="day.date"
          role="gridcell"
          data-drop="day"
          :data-date="day.date"
          :tabindex="day.date === cursor ? 0 : -1"
          :aria-selected="day.selected"
          :aria-disabled="day.disabled || undefined"
          :aria-current="day.today ? 'date' : undefined"
          :aria-label="dayLabel(day)"
          :class="[
            ns.e('day'),
            ns.is('outside', day.outside),
            ns.is('today', day.today),
            ns.is('selected', day.selected),
            ns.is('disabled', day.disabled),
            ns.is('drawing', inDrawing(day.date)),
            ns.is('refused', inDrawing(day.date) && refused),
          ]"
          @click="choose(day)"
        >
          <span :class="ns.e('number')">{{ day.day }}</span>
          <div :class="ns.e('content')">
            <slot name="cell" v-bind="day">
              <button
                v-for="event in day.events.slice(0, maxEvents)"
                :key="event.id"
                type="button"
                :data-event-id="event.id"
                :tabindex="day.date === cursor ? 0 : -1"
                :class="[
                  ns.e('event'),
                  `${ns.e('event')}--${event.tone ?? 'primary'}`,
                  ns.is('start', isStart(event, day.date)),
                  ns.is('continued', !isStart(event, day.date) && !weekStarts(day.date)),
                  ns.is('end', isEnd(event, day.date)),
                  ns.is('locked', !!editable && !!event.locked),
                  ns.is('dragging', event === dragged),
                  ns.is('refused', event === dragged && refused),
                ]"
                :title="event.title"
                :aria-keyshortcuts="editable && !event.locked ? keyShortcuts : undefined"
                @click.stop="emit('eventClick', event)"
              >
                <slot name="event" :event="event" :day="day"
                  ><span v-if="monthTime(event, day.date)" :class="ns.e('event-clock')">{{
                    monthTime(event, day.date)
                  }}</span
                  >{{ event.title }}</slot
                ><span
                  v-if="resizable(event, day.date)"
                  :class="[ns.e('resize'), `${ns.e('resize')}--x`]"
                  data-resize
                  aria-hidden="true"
                />
              </button>
              <span v-if="day.events.length > maxEvents" :class="ns.e('more')">
                {{ t('calendarView.more', { count: day.events.length - maxEvents }) }}
              </span>
            </slot>
          </div>
        </div>
      </div>
    </div>
    <span :class="ns.e('live')" aria-live="polite">{{ live }}</span>
    <div
      v-if="tip"
      :class="[ns.e('tip'), ns.is('refused', refused)]"
      :style="tipStyle"
      aria-hidden="true"
    >
      {{ tip }}
    </div>
    <!-- The calendar opens the menu itself; the empty anchor only gives it a place in the page. -->
    <DouContextMenu ref="menu" v-model:open="menuOpen" @select="onMenuSelect">
      <span :class="ns.e('menu-anchor')" aria-hidden="true" />
      <template #menu>
        <DouDropdownItem
          v-for="item in menuItems"
          :key="item.key"
          :value="item.key"
          :disabled="item.disabled"
          :tone="item.tone"
          :divided="item.divided"
          :shortcut="coarse() ? undefined : item.shortcut"
        >
          <template v-if="item.icon" #prefix>
            <DouIcon><component :is="item.icon" /></DouIcon>
          </template>
          {{ item.label }}
        </DouDropdownItem>
      </template>
    </DouContextMenu>
  </div>
</template>
