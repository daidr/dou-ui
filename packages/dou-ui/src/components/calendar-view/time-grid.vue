<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { today } from '../date-picker/date'
import type { CalendarDay, CalendarEvent } from './calendar-view'
import { layoutDay, segmentOn, toMinutes } from './time-layout'
import type { EventSpan } from './time-layout'

defineOptions({ name: 'DouCalendarTimeGrid' })

const props = defineProps<{
  days: CalendarDay[]
  spans: Map<CalendarEvent, EventSpan>
  hours: [number, number]
  scrollTime: string
  cursor: string
  /** Formats a day for the column header and screen readers. */
  asDate: (date: string) => Date
}>()
const emit = defineEmits<{
  choose: [day: CalendarDay]
  eventClick: [event: CalendarEvent]
  timeClick: [start: string]
}>()
defineSlots<{
  event?: (props: { event: CalendarEvent; day: CalendarDay }) => unknown
}>()

const ns = useNamespace('calendar-view')
const { t, locale } = useLocale()

const first = computed(() => Math.max(0, Math.min(23, Math.floor(props.hours[0]))))
const last = computed(() => Math.max(first.value + 1, Math.min(24, Math.ceil(props.hours[1]))))
const hourList = computed(() =>
  Array.from({ length: last.value - first.value }, (_, index) => first.value + index),
)

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value.name, { timeZone: 'UTC', ...options })
const hour12 = computed(() => /A/.test(locale.value.region.time))
const clock = computed(() =>
  formatter({ hour: 'numeric', minute: '2-digit', hourCycle: hour12.value ? 'h12' : 'h23' }),
)
const timeText = (minutes: number) => clock.value.format(new Date(Date.UTC(2000, 0, 1, 0, minutes)))
const weekdayFormat = computed(() => formatter({ weekday: 'short' }))
const fullDate = computed(() => formatter({ dateStyle: 'full' }))

const isTimed = (event: CalendarEvent) => props.spans.get(event)!.start !== null
const columns = computed(() =>
  props.days.map((day) => ({
    day,
    allDay: day.events.filter((event) => !isTimed(event)),
    timed: layoutDay(
      day.events
        .filter(isTimed)
        .map((event) => ({ event, ...segmentOn(props.spans.get(event)!, day.date) })),
    ),
  })),
)
const hasAllDay = computed(() => columns.value.some((column) => column.allDay.length))

const isStart = (event: CalendarEvent, date: string) => props.spans.get(event)!.from === date
const isEnd = (event: CalendarEvent, date: string) => props.spans.get(event)!.to <= date
const keyOf = (event: CalendarEvent) => event.id ?? `${event.start}:${event.title}`

const placement = (start: number, end: number, column = 0, count = 1, span = 1) => ({
  '--dou-calendar-view-from': (Math.max(start, first.value * 60) - first.value * 60) / 60,
  '--dou-calendar-view-length':
    (Math.min(end, last.value * 60) - Math.max(start, first.value * 60)) / 60,
  '--dou-calendar-view-column': column,
  '--dou-calendar-view-columns': count,
  '--dou-calendar-view-span': span,
})
/** Minutes of an event inside the hours shown. */
const shown = (item: { start: number; end: number }) =>
  Math.min(item.end, last.value * 60) - Math.max(item.start, first.value * 60)
const visible = (start: number, end: number) => end > first.value * 60 && start < last.value * 60

/** Names both days when a timed event runs past midnight. */
function eventLabel(event: CalendarEvent) {
  const span = props.spans.get(event)!
  const range = `${timeText(span.start!)}–${timeText(span.end!)}`
  if (span.from === span.to) return `${event.title}, ${range}`
  const from = fullDate.value.format(props.asDate(span.from))
  const to = fullDate.value.format(props.asDate(span.to))
  return `${event.title}, ${from} ${timeText(span.start!)} – ${to} ${timeText(span.end!)}`
}

/* the current time, only after mounting so server and client agree */

const now = ref<{ date: string; minutes: number } | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
function tick() {
  const date = new Date()
  now.value = { date: today(), minutes: date.getHours() * 60 + date.getMinutes() }
}

/* scrolling to the start time */

const scrollerRef = useTemplateRef<HTMLElement>('scroller')
function hourHeight() {
  const el = scrollerRef.value
  if (!el || typeof getComputedStyle === 'undefined') return 48
  return (
    Number.parseFloat(getComputedStyle(el).getPropertyValue('--dou-calendar-view-hour-height')) ||
    48
  )
}
async function scrollToStart() {
  await nextTick()
  const el = scrollerRef.value
  const minutes = toMinutes(props.scrollTime)
  if (!el || minutes === null) return
  // a little above the hour, so its label is not cut in half
  el.scrollTop = Math.max(0, ((minutes - first.value * 60) / 60) * hourHeight() - 8)
}

onMounted(() => {
  tick()
  timer = setInterval(tick, 60_000)
  void scrollToStart()
})
onBeforeUnmount(() => clearInterval(timer))
watch(() => props.days.length, scrollToStart)

function onColumnClick(event: MouseEvent, day: CalendarDay) {
  if (day.disabled) return
  const target = event.currentTarget as HTMLElement
  const y = event.clientY - target.getBoundingClientRect().top
  const minutes = first.value * 60 + Math.floor(((y / hourHeight()) * 60) / 30) * 30
  const clamped = Math.min(Math.max(minutes, first.value * 60), last.value * 60 - 30)
  const time = `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
  emit('timeClick', `${day.date} ${time}`)
}
</script>

<template>
  <div
    :class="ns.e('time')"
    :style="{
      '--dou-calendar-view-days': days.length,
      '--dou-calendar-view-hours': hourList.length,
    }"
  >
    <div :class="ns.e('time-head')">
      <span :class="ns.e('gutter')" />
      <button
        v-for="day in days"
        :key="day.date"
        type="button"
        :class="[ns.e('column-head'), ns.is('today', day.today), ns.is('selected', day.selected)]"
        :tabindex="day.date === cursor ? 0 : -1"
        :data-date="day.date"
        :disabled="day.disabled"
        :aria-label="fullDate.format(asDate(day.date))"
        :aria-current="day.today ? 'date' : undefined"
        :aria-pressed="day.selected"
        @click="emit('choose', day)"
      >
        <span :class="ns.e('column-weekday')">{{ weekdayFormat.format(asDate(day.date)) }}</span>
        <span :class="ns.e('number')">{{ day.day }}</span>
      </button>
    </div>
    <div v-if="hasAllDay" :class="ns.e('all-day')">
      <span :class="[ns.e('gutter'), ns.e('all-day-label')]">{{ t('calendarView.allDay') }}</span>
      <div v-for="(column, index) in columns" :key="column.day.date" :class="ns.e('all-day-cell')">
        <button
          v-for="event in column.allDay"
          :key="keyOf(event)"
          type="button"
          :class="[
            ns.e('event'),
            `${ns.e('event')}--${event.tone ?? 'primary'}`,
            ns.is('start', isStart(event, column.day.date)),
            ns.is('continued', !isStart(event, column.day.date) && index > 0),
            ns.is('end', isEnd(event, column.day.date)),
          ]"
          :title="event.title"
          @click="emit('eventClick', event)"
        >
          <slot name="event" :event="event" :day="column.day">{{ event.title }}</slot>
        </button>
      </div>
    </div>
    <div ref="scroller" :class="ns.e('scroller')">
      <div :class="ns.e('time-body')">
        <div :class="ns.e('hours')" aria-hidden="true">
          <span v-for="hour in hourList" :key="hour" :class="ns.e('hour')">
            <span v-if="hour > first" :class="ns.e('hour-label')">{{ timeText(hour * 60) }}</span>
          </span>
        </div>
        <div
          v-for="column in columns"
          :key="column.day.date"
          role="group"
          :aria-label="fullDate.format(asDate(column.day.date))"
          :class="[
            ns.e('column'),
            ns.is('today', column.day.today),
            ns.is('disabled', column.day.disabled),
          ]"
          @click.self="onColumnClick($event, column.day)"
        >
          <template v-for="item in column.timed" :key="keyOf(item.event)">
            <button
              v-if="visible(item.start, item.end)"
              type="button"
              :class="[
                ns.e('event'),
                ns.e('timed'),
                `${ns.e('event')}--${item.event.tone ?? 'primary'}`,
                ns.is('start'),
                ns.is('end'),
                ns.is('from-before', !isStart(item.event, column.day.date)),
                ns.is('runs-on', !isEnd(item.event, column.day.date)),
                ns.is('short', shown(item) < 45),
                ns.is('tall', shown(item) >= 90),
              ]"
              :style="placement(item.start, item.end, item.column, item.columns, item.span)"
              :aria-label="eventLabel(item.event)"
              @click="emit('eventClick', item.event)"
            >
              <slot name="event" :event="item.event" :day="column.day">
                <span :class="ns.e('event-title')">{{ item.event.title }}</span>
                <span v-if="isStart(item.event, column.day.date)" :class="ns.e('event-time')">
                  {{ timeText(item.start)
                  }}<span
                    v-if="isEnd(item.event, column.day.date) && shown(item) >= 45"
                    :class="ns.e('event-end')"
                  >
                    – {{ timeText(item.end) }}</span
                  >
                </span>
                <span v-else-if="isEnd(item.event, column.day.date)" :class="ns.e('event-time')">
                  – {{ timeText(item.end) }}
                </span>
              </slot>
            </button>
          </template>
          <span
            v-if="now && now.date === column.day.date && visible(now.minutes, now.minutes + 1)"
            :class="ns.e('now')"
            :style="placement(now.minutes, now.minutes)"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>
