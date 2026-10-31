<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { addDays, addMonths, parts, today, toDateString, weekday } from '../date-picker/date'
import { DouSegmentedControl } from '../segmented-control'
import type {
  CalendarDay,
  CalendarEvent,
  CalendarViewExpose,
  CalendarViewMode,
  CalendarViewProps,
  CalendarViewSlots,
} from './calendar-view'
import TimeGrid from './time-grid.vue'
import { segmentOn, spanOf } from './time-layout'
import type { EventSpan } from './time-layout'

defineOptions({ name: 'DouCalendarView' })

const props = withDefaults(defineProps<CalendarViewProps>(), {
  events: () => [],
  maxEvents: 3,
  hours: () => [0, 24],
  scrollTime: '08:00',
})
const model = defineModel<string | null>()
const month = defineModel<string>('month')
const view = defineModel<CalendarViewMode>('view', { default: 'month' })
const emit = defineEmits<{
  select: [date: string]
  eventClick: [event: CalendarEvent]
  timeClick: [start: string]
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

/** Where each event falls; events whose `start` can't be read are left out. */
const spans = computed(() => {
  const map = new Map<CalendarEvent, EventSpan>()
  for (const event of props.events) {
    const span = spanOf(event)
    if (span) map.set(event, span)
  }
  return map
})

// Events that can't be read are left out; say so once per event while developing.
const warned = new WeakSet<CalendarEvent>()
watch(
  () => props.events,
  (list) => {
    // the app's bundler replaces this, as for Vue's own warnings
    if (process.env.NODE_ENV === 'production') return
    for (const event of list) {
      if (spans.value.has(event) || warned.has(event)) continue
      warned.add(event)
      console.warn(
        `[dou-ui] CalendarView event "${event.title}" has a start that can't be read: "${event.start}". Use YYYY-MM-DD or YYYY-MM-DD HH:mm.`,
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

const keyOf = (event: CalendarEvent) => event.id ?? `${event.start}:${event.title}`
const isStart = (event: CalendarEvent, date: string) => spans.value.get(event)!.from === date
/** Whether the day opens a row, where a running span shows its title again. */
const weekStarts = (date: string) => (weekday(date) - weekStart.value + 7) % 7 === 0
const isEnd = (event: CalendarEvent, date: string) => spans.value.get(event)!.to <= date

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

defineExpose<CalendarViewExpose>({
  show: (date) => (cursor.value = date.length === 7 ? `${date}-01` : date),
  focus: () => void focusCursor(),
})
</script>

<template>
  <div ref="root" :class="[ns.b(), ns.m(view)]">
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
          ]"
          @click="choose(day)"
        >
          <span :class="ns.e('number')">{{ day.day }}</span>
          <div :class="ns.e('content')">
            <slot name="cell" v-bind="day">
              <button
                v-for="event in day.events.slice(0, maxEvents)"
                :key="keyOf(event)"
                type="button"
                :tabindex="day.date === cursor ? 0 : -1"
                :class="[
                  ns.e('event'),
                  `${ns.e('event')}--${event.tone ?? 'primary'}`,
                  ns.is('start', isStart(event, day.date)),
                  ns.is('continued', !isStart(event, day.date) && !weekStarts(day.date)),
                  ns.is('end', isEnd(event, day.date)),
                ]"
                :title="event.title"
                @click.stop="emit('eventClick', event)"
              >
                <slot name="event" :event="event" :day="day"
                  ><span v-if="monthTime(event, day.date)" :class="ns.e('event-clock')">{{
                    monthTime(event, day.date)
                  }}</span
                  >{{ event.title }}</slot
                >
              </button>
              <span v-if="day.events.length > maxEvents" :class="ns.e('more')">
                {{ t('calendarView.more', { count: day.events.length - maxEvents }) }}
              </span>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
