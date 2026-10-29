<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { addDays, addMonths, parts, today, toDateString, weekday } from '../date-picker/date'
import type {
  CalendarDay,
  CalendarEvent,
  CalendarViewExpose,
  CalendarViewProps,
  CalendarViewSlots,
} from './calendar-view'

defineOptions({ name: 'DouCalendarView' })

const props = withDefaults(defineProps<CalendarViewProps>(), {
  events: () => [],
  maxEvents: 3,
})
const model = defineModel<string | null>()
const month = defineModel<string>('month')
const emit = defineEmits<{ select: [date: string]; eventClick: [event: CalendarEvent] }>()
const slots = defineSlots<CalendarViewSlots>()

const ns = useNamespace('calendar-view')
const { t, locale } = useLocale()

const weekStart = computed(
  () => props.weekStart ?? (locale.value.name.toLowerCase().startsWith('en') ? 0 : 1),
)
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

const title = computed(() =>
  formatter({ year: 'numeric', month: 'long' }).format(asDate(`${shown.value}-01`)),
)
const fullDate = computed(() => formatter({ dateStyle: 'full' }))
const weekdays = computed(() => {
  const short = formatter({ weekday: 'short' })
  const long = formatter({ weekday: 'long' })
  // 2024-01-07 is a Sunday.
  return Array.from({ length: 7 }, (_, index) => {
    const date = asDate(toDateString(2024, 1, 7 + ((weekStart.value + index) % 7)))
    return { short: short.format(date), long: long.format(date) }
  })
})

/** Events by day, a span listed on every day it covers. */
const byDay = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of props.events) {
    const end = event.end && event.end > event.date ? event.end : event.date
    for (let date = event.date, guard = 0; date <= end && guard < 366; guard++) {
      const list = map.get(date) ?? []
      list.push(event)
      map.set(date, list)
      date = addDays(date, 1)
    }
  }
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

const keyOf = (event: CalendarEvent) => event.key ?? `${event.date}:${event.title}`
const isStart = (event: CalendarEvent, date: string) => event.date === date
/** Whether the day opens a row, where a running span shows its title again. */
const weekStarts = (date: string) => (weekday(date) - weekStart.value + 7) % 7 === 0
const isEnd = (event: CalendarEvent, date: string) => (event.end ?? event.date) <= date

/* choosing and moving */

const gridRef = useTemplateRef<HTMLElement>('grid')

async function focusCursor() {
  await nextTick()
  gridRef.value
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
  cursor.value = addMonths(cursor.value, direction)
}

function goToday() {
  cursor.value = todayValue
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
  <div :class="ns.b()">
    <div :class="ns.e('header')">
      <h2 :class="ns.e('title')" aria-live="polite">{{ title }}</h2>
      <div :class="ns.e('nav')">
        <slot name="extra" />
        <button type="button" :class="ns.e('today')" @click="goToday">
          {{ t('datePicker.today') }}
        </button>
        <button
          type="button"
          :class="ns.e('step')"
          :aria-label="t('datePicker.prevMonth')"
          @click="step(-1)"
        >
          <ChevronLeftIcon />
        </button>
        <button
          type="button"
          :class="ns.e('step')"
          :aria-label="t('datePicker.nextMonth')"
          @click="step(1)"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
    <div ref="grid" role="grid" :class="ns.e('grid')" :aria-label="title" @keydown="onKeydown">
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
                <slot name="event" :event="event" :day="day">{{ event.title }}</slot>
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
