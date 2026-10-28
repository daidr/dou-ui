<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import {
  addDays,
  addMonths,
  daysInMonth,
  expand,
  inBounds,
  parts,
  today,
  toDateString,
  truncate,
  unitOf,
  weekday,
} from './date'
import type { DateUnit } from './date'
import type {
  CalendarExpose,
  CalendarProps,
  CalendarSlots,
  DateRange,
  DateValue,
} from './date-picker'

defineOptions({ name: 'DouCalendar' })

const props = withDefaults(defineProps<CalendarProps>(), {
  type: 'date',
  range: false,
})
const model = defineModel<DateValue | DateRange | null>()
const emit = defineEmits<{ select: [value: DateValue | DateRange] }>()
const slots = defineSlots<CalendarSlots>()

const ns = useNamespace('calendar')
const { t, locale } = useLocale()
const id = `dou-calendar-${useId()}`

const unit = computed<DateUnit>(() => props.type)
const isRange = computed(() => props.range && unit.value === 'date')
const panelCount = computed(() => props.panels ?? (isRange.value ? 2 : 1))
const weekStart = computed(
  () => props.weekStart ?? (locale.value.name.toLowerCase().startsWith('en') ? 0 : 1),
)

/* the value */

const values = computed<string[]>(() => {
  const value = model.value
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).filter(Boolean)
})

// The first click of a range, waiting for the second.
const pending = ref<string | null>(null)
const hovered = ref<string | null>(null)

const shownRange = computed<[string, string] | null>(() => {
  if (!isRange.value) return null
  if (pending.value) {
    const other = hovered.value ?? pending.value
    return pending.value <= other ? [pending.value, other] : [other, pending.value]
  }
  const [start, end] = values.value
  return start && end ? [start, end] : null
})

function isDisabled(value: string) {
  if (!inBounds(value, props.min, props.max)) return true
  return value.length === 10 && !!props.disabledDate?.(value)
}

function clamp(date: string) {
  if (props.min && date < expand(props.min)) return expand(props.min)
  if (props.max && date > expand(props.max)) return expand(props.max)
  return date
}

/* where the calendar is looking */

type View = DateUnit
const view = ref<View>(unit.value)
const cursor = ref(clamp(values.value[0] ? expand(values.value[0]) : today()))
// The first month shown; a range shows the next one beside it.
const anchor = ref(cursor.value.slice(0, 7))

watch(unit, (value) => (view.value = value))
watch(cursor, (date) => {
  const month = date.slice(0, 7)
  const last = addMonths(`${anchor.value}-01`, panelCount.value - 1).slice(0, 7)
  if (month < anchor.value) anchor.value = month
  else if (month > last) anchor.value = addMonths(`${month}-01`, 1 - panelCount.value).slice(0, 7)
})
// A new value from outside brings its month into view.
watch(
  () => values.value[0],
  (value) => {
    if (value && !pending.value) show(value)
  },
)

function show(value: DateValue) {
  cursor.value = clamp(expand(value))
}

/* formatting */

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value.name, { timeZone: 'UTC', ...options })
const asDate = (date: string) => {
  const { year, month, day } = parts(date)
  const value = new Date(Date.UTC(2000, month - 1, day))
  value.setUTCFullYear(year)
  return value
}

const weekdays = computed(() => {
  const short = formatter({ weekday: 'short' })
  const long = formatter({ weekday: 'long' })
  // 2024-01-07 is a Sunday.
  return Array.from({ length: 7 }, (_, index) => {
    const date = asDate(toDateString(2024, 1, 7 + ((weekStart.value + index) % 7)))
    return { short: short.format(date), long: long.format(date) }
  })
})

const fullDate = computed(() => formatter({ dateStyle: 'full' }))
const monthName = computed(() => formatter({ month: 'short' }))
const monthTitle = computed(() => formatter({ year: 'numeric', month: 'long' }))
const yearTitle = computed(() => formatter({ year: 'numeric' }))

/* the grids */

interface DayCell {
  date: string
  day: number
  outside: boolean
  hidden: boolean
}

function weeksOf(month: string) {
  const first = `${month}-01`
  const offset = (weekday(first) - weekStart.value + 7) % 7
  const start = addDays(first, -offset)
  const weeks: DayCell[][] = []
  for (let row = 0; row < 6; row++) {
    const week: DayCell[] = []
    for (let column = 0; column < 7; column++) {
      const date = addDays(start, row * 7 + column)
      const outside = date.slice(0, 7) !== month
      week.push({ date, day: parts(date).day, outside, hidden: outside && panelCount.value > 1 })
    }
    weeks.push(week)
  }
  return weeks
}

const months = computed(() =>
  Array.from({ length: panelCount.value }, (_, index) => {
    const month = addMonths(`${anchor.value}-01`, index).slice(0, 7)
    return { month, title: monthTitle.value.format(asDate(`${month}-01`)), weeks: weeksOf(month) }
  }),
)

const cursorYear = computed(() => parts(cursor.value).year)
const decade = computed(() => Math.floor(cursorYear.value / 10) * 10)

const monthCells = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const value = `${String(cursorYear.value).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`
    return { value, label: monthName.value.format(asDate(`${value}-01`)) }
  }),
)
const yearCells = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const year = decade.value - 1 + index
    return { value: String(year).padStart(4, '0'), outside: index === 0 || index === 11 }
  }),
)
// Three rows of four, for the month and year grids.
const rowsOf = <T,>(cells: T[]) => [cells.slice(0, 4), cells.slice(4, 8), cells.slice(8, 12)]

/* cell states */

const todayValue = today()
const isSelected = (value: string) => {
  if (pending.value) return value === pending.value
  return values.value.some((selected) => truncate(expand(selected), unitOf(value)) === value)
}
const inRange = (date: string) =>
  !!shownRange.value && date > shownRange.value[0] && date < shownRange.value[1]
const isEdge = (date: string, edge: 0 | 1) => shownRange.value?.[edge] === date

const activeValue = computed(() => truncate(cursor.value, view.value))

/* picking */

function commit(value: DateValue | DateRange) {
  model.value = value
  emit('select', value)
}

function pickDate(date: string) {
  if (isDisabled(date)) return
  cursor.value = date
  if (!isRange.value) return commit(date)
  if (!pending.value) {
    pending.value = date
    hovered.value = date
    return
  }
  const start = pending.value
  pending.value = null
  hovered.value = null
  commit(start <= date ? [start, date] : [date, start])
}

function pickMonth(value: string) {
  if (isDisabled(value)) return
  const { day } = parts(cursor.value)
  const { year, month } = parts(`${value}-01`)
  cursor.value = clamp(toDateString(year, month, Math.min(day, daysInMonth(year, month))))
  if (unit.value === 'month') commit(value)
  else void moveView('date')
}

function pickYear(value: string) {
  if (isDisabled(value)) return
  const { month, day } = parts(cursor.value)
  const year = Number(value)
  cursor.value = clamp(toDateString(year, month, Math.min(day, daysInMonth(year, month))))
  if (unit.value === 'year') commit(value)
  else void moveView('month')
}

/* navigating */

const gridRef = useTemplateRef<HTMLElement>('grid')

async function focusActive() {
  await nextTick()
  gridRef.value
    ?.querySelector<HTMLElement>(`[data-value="${activeValue.value}"]`)
    ?.focus({ preventScroll: true })
}

async function moveView(next: View) {
  const hadFocus = !!gridRef.value?.contains(document.activeElement)
  view.value = next
  if (hadFocus) await focusActive()
}

function openMonths(month: string) {
  cursor.value = clamp(`${month}-01`)
  void moveView('month')
}

function step(direction: 1 | -1) {
  if (view.value === 'date') {
    anchor.value = addMonths(`${anchor.value}-01`, direction).slice(0, 7)
    cursor.value = addMonths(cursor.value, direction)
  } else if (view.value === 'month') cursor.value = addMonths(cursor.value, direction * 12)
  else cursor.value = addMonths(cursor.value, direction * 120)
}

const stepLabels = computed(() => {
  if (view.value === 'date') return [t('datePicker.prevMonth'), t('datePicker.nextMonth')]
  if (view.value === 'month') return [t('datePicker.prevYear'), t('datePicker.nextYear')]
  return [t('datePicker.prevDecade'), t('datePicker.nextDecade')]
})

function onGridKeydown(event: KeyboardEvent) {
  const date = cursor.value
  let next: string | undefined
  const page = (count: number) => addMonths(date, event.shiftKey ? count * 12 : count)
  if (view.value === 'date') {
    const column = (weekday(date) - weekStart.value + 7) % 7
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      Home: () => addDays(date, -column),
      End: () => addDays(date, 6 - column),
      PageUp: () => page(-1),
      PageDown: () => page(1),
    }
    next = keys[event.key]?.()
  } else {
    const size = view.value === 'month' ? 1 : 12
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addMonths(date, -size),
      ArrowRight: () => addMonths(date, size),
      ArrowUp: () => addMonths(date, -4 * size),
      ArrowDown: () => addMonths(date, 4 * size),
      PageUp: () => addMonths(date, -12 * (view.value === 'month' ? 1 : 10)),
      PageDown: () => addMonths(date, 12 * (view.value === 'month' ? 1 : 10)),
    }
    next = keys[event.key]?.()
  }
  if (next) {
    event.preventDefault()
    cursor.value = next
    if (pending.value) hovered.value = next
    void focusActive()
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (view.value === 'date') pickDate(cursor.value)
    else if (view.value === 'month') pickMonth(activeValue.value)
    else pickYear(activeValue.value)
  }
}

defineExpose<CalendarExpose>({ focus: () => void focusActive(), show })

const classes = computed(() => [
  ns.b(),
  ns.m(view.value),
  ns.is('range', isRange.value),
  ns.is('picking', !!pending.value),
])
</script>

<template>
  <div :class="classes">
    <div ref="grid" :class="ns.e('panels')" @keydown="onGridKeydown">
      <!-- days -->
      <template v-if="view === 'date'">
        <div v-for="(panel, index) in months" :key="index" :class="ns.e('panel')">
          <div :class="ns.e('header')">
            <button
              v-if="index === 0"
              type="button"
              :class="ns.e('step')"
              :aria-label="stepLabels[0]"
              @click="step(-1)"
            >
              <ChevronLeftIcon />
            </button>
            <span v-else :class="ns.e('step-space')" />
            <button
              :id="`${id}-title-${index}`"
              type="button"
              :class="ns.e('title')"
              aria-live="polite"
              @click="openMonths(panel.month)"
            >
              {{ panel.title }}
            </button>
            <button
              v-if="index === months.length - 1"
              type="button"
              :class="ns.e('step')"
              :aria-label="stepLabels[1]"
              @click="step(1)"
            >
              <ChevronRightIcon />
            </button>
            <span v-else :class="ns.e('step-space')" />
          </div>
          <table role="grid" :class="ns.e('grid')" :aria-labelledby="`${id}-title-${index}`">
            <thead>
              <tr>
                <th v-for="day in weekdays" :key="day.long" scope="col" :abbr="day.long">
                  {{ day.short }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(week, row) in panel.weeks" :key="row">
                <td
                  v-for="cell in week"
                  :key="cell.date"
                  :class="[
                    ns.e('cell'),
                    ns.is('outside', cell.outside),
                    ns.is('hidden', cell.hidden),
                    ns.is('in-range', !cell.hidden && inRange(cell.date)),
                    ns.is('range-start', !cell.hidden && isEdge(cell.date, 0)),
                    ns.is('range-end', !cell.hidden && isEdge(cell.date, 1)),
                  ]"
                  :aria-selected="cell.hidden ? undefined : isSelected(cell.date)"
                >
                  <button
                    v-if="!cell.hidden"
                    type="button"
                    :data-value="cell.date"
                    :tabindex="cell.date === activeValue ? 0 : -1"
                    :class="[
                      ns.e('day'),
                      ns.is('today', cell.date === todayValue),
                      ns.is('selected', isSelected(cell.date)),
                      ns.is('disabled', isDisabled(cell.date)),
                    ]"
                    :aria-label="fullDate.format(asDate(cell.date))"
                    :aria-current="cell.date === todayValue ? 'date' : undefined"
                    :aria-disabled="isDisabled(cell.date) || undefined"
                    @click="pickDate(cell.date)"
                    @mouseenter="pending && (hovered = cell.date)"
                  >
                    <slot name="cell" :date="cell.date" :day="cell.day">{{ cell.day }}</slot>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- months or years -->
      <div v-else :class="ns.e('panel')">
        <div :class="ns.e('header')">
          <button type="button" :class="ns.e('step')" :aria-label="stepLabels[0]" @click="step(-1)">
            <ChevronLeftIcon />
          </button>
          <button
            v-if="view === 'month'"
            :id="`${id}-title-0`"
            type="button"
            :class="ns.e('title')"
            aria-live="polite"
            @click="moveView('year')"
          >
            {{ yearTitle.format(asDate(cursor)) }}
          </button>
          <span
            v-else
            :id="`${id}-title-0`"
            :class="[ns.e('title'), ns.is('static', true)]"
            aria-live="polite"
          >
            {{ decade }} – {{ decade + 9 }}
          </span>
          <button type="button" :class="ns.e('step')" :aria-label="stepLabels[1]" @click="step(1)">
            <ChevronRightIcon />
          </button>
        </div>
        <table
          role="grid"
          :class="[ns.e('grid'), ns.e('grid--wide')]"
          :aria-labelledby="`${id}-title-0`"
        >
          <tbody>
            <template v-if="view === 'month'">
              <tr v-for="(row, index) in rowsOf(monthCells)" :key="index">
                <td
                  v-for="cell in row"
                  :key="cell.value"
                  :class="ns.e('cell')"
                  :aria-selected="isSelected(cell.value)"
                >
                  <button
                    type="button"
                    :data-value="cell.value"
                    :tabindex="cell.value === activeValue ? 0 : -1"
                    :class="[
                      ns.e('day'),
                      ns.is('today', cell.value === todayValue.slice(0, 7)),
                      ns.is('selected', isSelected(cell.value)),
                      ns.is('disabled', isDisabled(cell.value)),
                    ]"
                    :aria-disabled="isDisabled(cell.value) || undefined"
                    @click="pickMonth(cell.value)"
                  >
                    {{ cell.label }}
                  </button>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="(row, index) in rowsOf(yearCells)" :key="index">
                <td
                  v-for="cell in row"
                  :key="cell.value"
                  :class="[ns.e('cell'), ns.is('outside', cell.outside)]"
                  :aria-selected="isSelected(cell.value)"
                >
                  <button
                    type="button"
                    :data-value="cell.value"
                    :tabindex="cell.value === activeValue ? 0 : -1"
                    :class="[
                      ns.e('day'),
                      ns.is('today', cell.value === todayValue.slice(0, 4)),
                      ns.is('selected', isSelected(cell.value)),
                      ns.is('disabled', isDisabled(cell.value)),
                    ]"
                    :aria-disabled="isDisabled(cell.value) || undefined"
                    @click="pickYear(cell.value)"
                  >
                    {{ Number(cell.value) }}
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="slots.footer" :class="ns.e('footer')"><slot name="footer" /></div>
  </div>
</template>
