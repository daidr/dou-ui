<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { useTeleport } from '../../utils/teleport'
import { useLocale } from '../config-provider/use-config'
import { addDays, parts, today, toDateString, weekday } from '../date-picker/date'
import { datePattern, formatWith } from '../date-picker/pattern'
import type {
  CalendarHeatmapDatum,
  CalendarHeatmapProps,
  CalendarHeatmapSlots,
} from './calendar-heatmap'

defineOptions({ name: 'DouCalendarHeatmap' })

const props = withDefaults(defineProps<CalendarHeatmapProps>(), {
  data: () => [],
  tone: 'primary',
  levels: 4,
  legend: true,
})
const emit = defineEmits<{ select: [datum: CalendarHeatmapDatum] }>()
const slots = defineSlots<CalendarHeatmapSlots>()

const ns = useNamespace('calendar-heatmap')
const { locale, t } = useLocale()
const id = `dou-calendar-heatmap-${useId()}`

/* the days */

const last = computed(() => props.end ?? today())
const first = computed(() => props.start ?? addDays(last.value, -364))
const weekStart = computed(() => props.weekStart ?? locale.value.region.weekStart)
/** The row of a day: `0` is the first day of the week. */
const row = (date: string) => (weekday(date) - weekStart.value + 7) % 7
/** The first column starts on the week's first day, so earlier days of that week stay blank. */
const origin = computed(() => addDays(first.value, -row(first.value)))
const daysBetween = (from: string, to: string) => {
  const a = parts(from)
  const b = parts(to)
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  )
}
const column = (date: string) => Math.floor(daysBetween(origin.value, date) / 7)

const values = computed(() => {
  const map = new Map<string, number>()
  for (const { date, value } of props.data) map.set(date, (map.get(date) ?? 0) + value)
  return map
})

const shades = computed(() => props.thresholds?.length ?? Math.max(1, props.levels))
const max = computed(() => {
  let largest = 0
  for (const value of values.value.values()) largest = Math.max(largest, value)
  return largest
})
function levelOf(value: number) {
  if (value <= 0) return 0
  if (props.thresholds?.length) return props.thresholds.filter((low) => value >= low).length
  return Math.min(shades.value, Math.ceil((value / (max.value || 1)) * shades.value))
}

const colors = computed(() => {
  if (props.colors?.length) return props.colors
  const empty = `var(--dou-calendar-heatmap-empty)`
  const color = `var(--dou-color-${props.tone})`
  return [
    empty,
    ...Array.from({ length: shades.value }, (_, index) => {
      // from a light tint up to the full color
      const share = shades.value === 1 ? 100 : Math.round(24 + (76 * index) / (shades.value - 1))
      return share === 100 ? color : `color-mix(in oklab, ${color} ${share}%, ${empty})`
    }),
  ]
})

interface Cell {
  date: string
  value: number
  level: number
  row: number
  column: number
}

const cells = computed<Cell[]>(() => {
  const list: Cell[] = []
  const count = daysBetween(first.value, last.value)
  for (let offset = 0; offset <= count; offset++) {
    const date = addDays(first.value, offset)
    const value = values.value.get(date) ?? 0
    list.push({ date, value, level: levelOf(value), row: row(date), column: column(date) })
  }
  return list
})
const weeks = computed(() => column(last.value) + 1)

/* labels */

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value.name, { timeZone: 'UTC', ...options })
const asUTC = (date: string) => {
  const { year, month, day } = parts(date)
  return new Date(Date.UTC(year, month - 1, day))
}

const months = computed(() => {
  const short = formatter({ month: 'short' })
  const labels: { text: string; column: number }[] = []
  for (const cell of cells.value) {
    if (parts(cell.date).day !== 1 && cell.date !== first.value) continue
    // a month that starts too close to the previous label would run into it
    const previous = labels.at(-1)
    if (previous && cell.column - previous.column < 3) {
      if (cell.date === first.value) continue
      labels.pop()
    }
    labels.push({ text: short.format(asUTC(cell.date)), column: cell.column })
  }
  return labels
})

const weekdays = computed(() => {
  const short = formatter({ weekday: 'short' })
  // 2024-01-07 is a Sunday; label Monday, Wednesday and Friday
  return [1, 3, 5].map((day) => ({
    text: short.format(asUTC(toDateString(2024, 1, 7 + day))),
    row: (day - weekStart.value + 7) % 7,
  }))
})

const pattern = computed(() => datePattern(t('region.date'), 'date'))
const formatDate = (date: string) => (pattern.value ? formatWith(date, pattern.value) : date)
const label = (cell: Cell) =>
  t('calendarHeatmap.day', { date: formatDate(cell.date), value: cell.value })

/* focus and keyboard */

const gridRef = useTemplateRef<HTMLElement>('grid')
const cursor = ref<string | null>(null)
const focusable = computed(() => {
  const date = cursor.value
  return date && date >= first.value && date <= last.value ? date : last.value
})

const cellEl = (date: string) =>
  gridRef.value?.querySelector<HTMLElement>(`[data-date="${date}"]`) ?? null

async function moveTo(date: string) {
  const clamped = date < first.value ? first.value : date > last.value ? last.value : date
  cursor.value = clamped
  await nextTick()
  cellEl(clamped)?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const date = (event.target as HTMLElement).dataset.date
  if (!date) return
  const moves: Record<string, () => string> = {
    ArrowLeft: () => addDays(date, -7),
    ArrowRight: () => addDays(date, 7),
    ArrowUp: () => addDays(date, -1),
    ArrowDown: () => addDays(date, 1),
    Home: () => first.value,
    End: () => last.value,
  }
  if (event.key in moves) {
    event.preventDefault()
    void moveTo(moves[event.key]!())
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    choose(date)
  }
}

function choose(date: string) {
  emit('select', { date, value: values.value.get(date) ?? 0 })
}

// When the grid is wider than its box, start scrolled to the most recent weeks.
const scrollRef = useTemplateRef<HTMLElement>('scroll')
onMounted(() => {
  const box = scrollRef.value
  if (box) box.scrollLeft = box.scrollWidth
})

/* tooltip */

const active = ref<string | null>(null)
const activeCell = computed(() => cells.value.find((cell) => cell.date === active.value) ?? null)
const open = computed({
  get: () => active.value !== null,
  set: (value) => {
    if (!value) active.value = null
  },
})
const popup = usePopup({
  open,
  trigger: 'manual',
  placement: 'top',
  offset: 6,
  anchor: () => (active.value ? cellEl(active.value) : null),
})
const { panelRef, rendered, theme, placement, panelStyle } = popup
const teleportTarget = useTeleport(() => undefined)
watch(active, (date) => date && void nextTick(popup.update))

function cellOf(event: Event) {
  return (event.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date ?? null
}
const onPointerover = (event: PointerEvent) => (active.value = cellOf(event))
const onPointerleave = () => (active.value = null)
function onFocusin(event: FocusEvent) {
  const date = cellOf(event)
  if (!date) return
  cursor.value = date
  active.value = date
}
const onFocusout = () => (active.value = null)
function onClick(event: MouseEvent) {
  const date = cellOf(event)
  if (date) choose(date)
}
</script>

<template>
  <div :class="ns.b()">
    <div ref="scroll" :class="ns.e('scroll')">
      <div
        ref="grid"
        role="grid"
        :class="ns.e('grid')"
        :style="{ '--dou-calendar-heatmap-weeks': weeks }"
        @pointerover="onPointerover"
        @pointerleave="onPointerleave"
        @focusin="onFocusin"
        @focusout="onFocusout"
        @click="onClick"
        @keydown="onKeydown"
      >
        <span
          v-for="month in months"
          :key="month.column"
          :class="ns.e('month')"
          :style="{ gridColumn: month.column + 2 }"
          aria-hidden="true"
          >{{ month.text }}</span
        >
        <span
          v-for="day in weekdays"
          :key="day.row"
          :class="ns.e('weekday')"
          :style="{ gridRow: day.row + 2 }"
          aria-hidden="true"
          >{{ day.text }}</span
        >
        <div v-for="r in 7" :key="r" role="row" :class="ns.e('row')">
          <span
            v-for="cell in cells.filter((item) => item.row === r - 1)"
            :key="cell.date"
            role="gridcell"
            :class="[ns.e('cell'), ns.is('active', cell.date === active)]"
            :style="{
              gridRow: cell.row + 2,
              gridColumn: cell.column + 2,
              backgroundColor: colors[cell.level],
            }"
            :data-date="cell.date"
            :data-level="cell.level"
            :tabindex="cell.date === focusable ? 0 : -1"
            :aria-label="label(cell)"
            :aria-describedby="cell.date === active ? id : undefined"
          />
        </div>
      </div>
    </div>
    <div v-if="legend" :class="ns.e('legend')">
      <slot name="legend" :colors="colors">
        <span>{{ t('calendarHeatmap.less') }}</span>
        <span
          v-for="(color, index) in colors"
          :key="index"
          :class="ns.e('swatch')"
          :style="{ backgroundColor: color }"
        />
        <span>{{ t('calendarHeatmap.more') }}</span>
      </slot>
    </div>
    <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="tooltip"
        :class="['dou-tooltip', 'dou-floating', 'is-static', ns.e('tooltip')]"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
      >
        <template v-if="activeCell">
          <slot
            name="tooltip"
            :date="activeCell.date"
            :value="activeCell.value"
            :level="activeCell.level"
            >{{ label(activeCell) }}</slot
          >
        </template>
      </div>
    </Teleport>
  </div>
</template>
