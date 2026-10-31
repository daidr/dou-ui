<script setup lang="ts">
import { ArrowRightIcon, CalendarIcon, CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { InputHTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useCoarsePointer } from '../../utils/media'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import { formatTime, now, parseTime } from '../time-picker/time'
import type { TimeParts } from '../time-picker/time'
import TimeColumns from '../time-picker/time-columns.vue'
import DouCalendar from './calendar.vue'
import { inBounds, parseDate, today } from './date'
import { datePattern, formatWith, parseWith } from './pattern'
import type {
  CalendarExpose,
  DatePickerExpose,
  DatePickerProps,
  DatePickerShortcut,
  DatePickerSlots,
  DateRange,
  DateValue,
} from './date-picker'
import { useTeleport } from '../../utils/teleport'

// The calendar is a second root, so attributes go to the field by hand.
defineOptions({ name: 'DouDatePicker', inheritAttrs: false })

const props = withDefaults(defineProps<DatePickerProps>(), {
  type: 'date',
  range: false,
  timeFormat: 'HH:mm',
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const model = defineModel<DateValue | DateRange | null>()
const emit = defineEmits<{
  select: [value: DateValue | DateRange]
  change: [value: DateValue | DateRange | null]
}>()
const slots = defineSlots<DatePickerSlots>()

const ns = useNamespace('date-picker')
// On a phone the panel is how a value is picked, so typing stays off.
const coarse = useCoarsePointer()
const { t, locale } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
// Read-only keeps the field focusable but never opens or changes it.
const locked = computed(() => disabled.value || readonly.value)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const id = `dou-date-picker-${useId()}`
const panelId = `${id}-panel`

const isDateTime = computed(() => props.type === 'datetime')
const isRange = computed(() => props.range && props.type !== 'week')
// The calendar only ever picks the day of a `datetime`.
const calendarType = computed(() => (props.type === 'datetime' ? 'date' : props.type))
const seconds = computed(() => props.timeFormat === 'HH:mm:ss')

/* a day with a time: `YYYY-MM-DD HH:mm(:ss)` */

const dayOf = (value: string | undefined) => value?.slice(0, 10)
const timeOf = (value: string | undefined) => (value ? parseTime(value.slice(11)) : null)
const withTime = (day: string, time: TimeParts) => `${day} ${formatTime(time, props.timeFormat)}`

function defaultTime(index: number): TimeParts {
  const given = Array.isArray(props.defaultTime) ? props.defaultTime[index] : props.defaultTime
  const parsed = given ? parseTime(given) : null
  if (parsed) return parsed
  return isRange.value && index === 1
    ? { hour: 23, minute: 59, second: 59 }
    : { hour: 0, minute: 0, second: 0 }
}

/*
 * how the day is written in the field: `displayFormat`, else the locale's
 * pattern; weeks stay ISO, quarters follow the locale's text
 */

const pattern = computed(() => {
  const unit = calendarType.value
  if (unit === 'week' || unit === 'quarter') return null
  const fromLocale = () => datePattern(locale.value.region[unit], unit)
  return (props.displayFormat ? datePattern(props.displayFormat, unit) : null) ?? fromLocale()
})

function display(value: string) {
  if (props.type === 'quarter' && /^\d{4}-Q[1-4]$/.test(value)) {
    return t('datePicker.quarter', { year: value.slice(0, 4), quarter: value[6]! })
  }
  const parts = pattern.value
  if (!parts || !value) return value
  return formatWith(value.slice(0, 10), parts) + value.slice(10)
}

/**
 * Read what was typed, through the pattern or as ISO. A `datetime` is a
 * day, then optionally a time after a space or `T`.
 */
function parseAt(text: string, index: number) {
  const parts = pattern.value
  if (props.type === 'quarter') return parseQuarter(text)
  if (props.type !== 'datetime') {
    const read = parts && props.type !== 'week' && parseWith(text, parts, props.type)
    return read && !read.rest.trim() ? read.value : parseDate(text, props.type)
  }
  let date: string | null
  let time: string | undefined
  const read = parts && parseWith(text, parts, 'date')
  if (read) {
    date = read.value
    time = read.rest.trim().replace(/^T\s*/i, '') || undefined
  } else {
    const [day = '', rest] = text.trim().split(/\s*[\sT]\s*/)
    date = parseDate(day, 'date')
    time = rest
  }
  const clock = time === undefined ? defaultTime(index) : parseTime(time)
  return date && clock ? withTime(date, clock) : null
}

/** Read a quarter as the locale writes it, or as `2026-Q4`, `2026 Q4` or `Q4 2026`. */
function parseQuarter(text: string) {
  const source = t('datePicker.quarter')
    .split(/(\{year\}|\{quarter\})/)
    .map((piece) => {
      if (piece === '{year}') return '(?<year>\\d{4})'
      if (piece === '{quarter}') return '(?<quarter>[1-4])'
      return piece
        .trim()
        .replace(/[$()*+.?[\\\]^{|}-]/g, '\\$&')
        .replace(/\s+/g, '\\s*')
    })
    .join('\\s*')
  const groups = new RegExp(`^\\s*${source}\\s*$`, 'i').exec(text)?.groups
  if (groups?.year && groups.quarter) return `${groups.year}-Q${groups.quarter}`
  return parseDate(text, 'quarter')
}

/* the text in the fields, kept apart from the value while typing */

const values = computed<string[]>(() => {
  const value = model.value
  if (!value) return []
  return Array.isArray(value) ? value : [value]
})
const texts = ref<string[]>([])
const syncTexts = () => {
  texts.value = isRange.value
    ? [display(values.value[0] ?? ''), display(values.value[1] ?? '')]
    : [display(values.value[0] ?? '')]
}
watch([values, isRange, pattern], syncTexts, { immediate: true })

const allowed = (value: string) => {
  const day = value.length > 10 ? value.slice(0, 10) : value
  return inBounds(day, props.min, props.max) && !(day.length === 10 && props.disabledDate?.(day))
}

const same = (a: DateValue | DateRange | null | undefined, b: DateValue | DateRange | null) =>
  JSON.stringify(a ?? null) === JSON.stringify(b)

function commit(value: DateValue | DateRange | null) {
  if (same(model.value, value)) return syncTexts()
  model.value = value
  emit('change', value)
  formItem?.trigger('change')
  // A bound value only arrives on the next render; show it now.
  texts.value =
    value === null
      ? texts.value.map(() => '')
      : (Array.isArray(value) ? value : [value]).map(display)
}

/** Turn what was typed into a value, or put the old text back. */
function commitTexts() {
  const parsed = texts.value.map((text, index) => (text.trim() ? parseAt(text, index) : ''))
  if (parsed.every((value) => value === '')) {
    if (values.value.length) commit(null)
    return
  }
  if (parsed.some((value) => !value || !allowed(value))) return syncTexts()
  if (!isRange.value) return commit(parsed[0]!)
  const [start, end] = parsed as [string, string]
  commit(start <= end ? [start, end] : [end, start])
}

/* the popup */

const open = ref(false)
const popup = usePopup({
  open,
  trigger: 'manual',
  closeOnOutside: true,
  disabled: locked,
  placement: () => props.placement,
  offset: 4,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup

const calendarRef = useTemplateRef<CalendarExpose>('calendar')
const startRef = useTemplateRef<HTMLInputElement>('start')
const fieldRef = useTemplateRef<HTMLElement>('field')

function show() {
  if (locked.value || open.value) return
  draft.value = [...values.value]
  open.value = true
}
function hide() {
  open.value = false
}

function focus() {
  startRef.value?.focus()
}

async function focusCalendar() {
  show()
  await nextTick()
  calendarRef.value?.focus()
}

/* a `datetime` is put together in the panel and committed on confirm */

const draft = ref<string[]>([])
const calendarValue = computed(() => {
  if (!isDateTime.value) return model.value
  if (!isRange.value) return dayOf(draft.value[0]) ?? null
  const [start, end] = draft.value
  return start && end ? ([dayOf(start)!, dayOf(end)!] as DateRange) : null
})
const draftTimes = computed(() =>
  Array.from({ length: isRange.value ? 2 : 1 }, (_, index) => timeOf(draft.value[index])),
)
const ordered = (list: string[]) => (list[0]! <= list[1]! ? list : [list[1]!, list[0]!])
const canConfirm = computed(() =>
  isRange.value ? !!(draft.value[0] && draft.value[1]) : !!draft.value[0],
)

function onCalendarSelect(value: DateValue | DateRange) {
  if (!isDateTime.value) return onSelect(value)
  const days = Array.isArray(value) ? value : [value]
  draft.value = days.map((day, index) =>
    withTime(day, timeOf(draft.value[index]) ?? defaultTime(index)),
  )
}

function onTimePick(index: number, time: TimeParts) {
  const list = [...draft.value]
  const day = dayOf(list[index]) ?? dayOf(list[0]) ?? today()
  list[index] = withTime(day, time)
  // a range whose start has a time but no end yet: the end starts on the same day
  if (isRange.value && index === 0 && !list[1]) list[1] = withTime(day, defaultTime(1))
  draft.value = list
}

function confirm() {
  if (!canConfirm.value) return
  const list = isRange.value ? ordered(draft.value) : draft.value
  onSelect(isRange.value ? (list.slice(0, 2) as DateRange) : list[0]!)
}

function pickNow() {
  const time = now()
  onSelect(withTime(today(), { ...time, second: seconds.value ? time.second : 0 }))
}

function pickShortcut(shortcut: DatePickerShortcut) {
  const value = typeof shortcut.value === 'function' ? shortcut.value() : shortcut.value
  onSelect(Array.isArray(value) ? ([...value] as DateRange) : value)
}

function onSelect(value: DateValue | DateRange) {
  commit(value)
  emit('select', value)
  hide()
  focus()
}

function pick(value: DateValue | DateRange) {
  onSelect(value)
}

/* typing */

function onInput(index: number) {
  show()
  const value = parseAt(texts.value[index] ?? '', index)
  if (value) calendarRef.value?.show(value)
}

function onKeydown(event: KeyboardEvent) {
  if (locked.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    void focusCalendar()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (open.value) {
      commitTexts()
      hide()
    } else show()
  }
}

// `Escape` inside the calendar closes it and goes back to the field.
function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  hide()
  focus()
}

// Pressing the field opens the calendar and keeps focus in a text box.
function onFieldMousedown(event: MouseEvent) {
  if (locked.value) return
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  if (target.tagName !== 'INPUT') {
    event.preventDefault()
    focus()
  }
  if (open.value && target.tagName !== 'INPUT') hide()
  else show()
}

// Pressing the panel between its buttons keeps focus where it was.
function onPanelMousedown(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('button, input, select, textarea, [tabindex]')) {
    event.preventDefault()
  }
}

function onFocusout(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && (fieldRef.value?.contains(next) || panelRef.value?.contains(next))) {
    return
  }
  // A button the calendar re-renders (a header that turns into another
  // view) takes focus with it; that is not the user leaving.
  const target = event.target
  if (
    !next &&
    target instanceof Element &&
    (!target.isConnected || panelRef.value?.contains(target))
  ) {
    void nextTick(() => {
      if (target.isConnected) return leave()
      if (!panelRef.value?.contains(document.activeElement)) calendarRef.value?.focus()
    })
    return
  }
  leave()
}

function leave() {
  commitTexts()
  hide()
  formItem?.trigger('blur')
}

function clear() {
  commit(null)
  hide()
  focus()
}

/* labels */

const placeholders = computed(() => {
  if (isRange.value) {
    return [
      props.startPlaceholder ?? t('datePicker.start'),
      props.endPlaceholder ?? t('datePicker.end'),
    ]
  }
  const fallbacks = {
    date: t('datePicker.placeholder'),
    datetime: t('datePicker.datetimePlaceholder'),
    week: t('datePicker.weekPlaceholder'),
    month: t('datePicker.monthPlaceholder'),
    quarter: t('datePicker.quarterPlaceholder'),
    year: t('datePicker.yearPlaceholder'),
  }
  const fallback = fallbacks[props.type]
  return [props.placeholder ?? fallback]
})

const inputAttrs = (index: number): InputHTMLAttributes => ({
  role: 'combobox',
  'aria-haspopup': 'dialog',
  'aria-expanded': open.value,
  'aria-controls': rendered.value ? panelId : undefined,
  'aria-invalid': invalid.value || undefined,
  'aria-required': formItem?.required.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
  'aria-label': isRange.value ? placeholders.value[index] : undefined,
})

const showClear = computed(() => props.clearable && !locked.value && values.value.length > 0)
const showToday = computed(() => !isRange.value && props.type === 'date' && allowed(today()))
const showNow = computed(() => isDateTime.value && !isRange.value && allowed(today()))

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('range', isRange.value),
  ns.is('datetime', isDateTime.value),
  ns.is('open', open.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('clearable', showClear.value),
])

defineExpose<DatePickerExpose>({
  focus,
  blur: () => (document.activeElement as HTMLElement)?.blur(),
})
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      v-bind="$attrs"
      :class="classes"
      :role="isRange ? 'group' : undefined"
      :aria-labelledby="isRange ? formItem?.labelId : undefined"
      @mousedown="onFieldMousedown"
      @focusout="onFocusout"
    >
      <CalendarIcon :class="ns.e('icon')" />
      <input
        ref="start"
        v-model="texts[0]"
        v-bind="inputAttrs(0)"
        :id="formItem?.inputId"
        :class="ns.e('input')"
        type="text"
        :inputmode="coarse ? 'none' : undefined"
        autocomplete="off"
        :placeholder="placeholders[0]"
        :disabled="disabled"
        :readonly="readonly"
        @input="onInput(0)"
        @keydown="onKeydown"
      />
      <template v-if="isRange">
        <ArrowRightIcon :class="ns.e('separator')" />
        <input
          ref="end"
          v-model="texts[1]"
          v-bind="inputAttrs(1)"
          :class="ns.e('input')"
          type="text"
          :inputmode="coarse ? 'none' : undefined"
          autocomplete="off"
          :placeholder="placeholders[1]"
          :disabled="disabled"
          :readonly="readonly"
          @input="onInput(1)"
          @keydown="onKeydown"
        />
      </template>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        :class="ns.e('clear')"
        :aria-label="t('datePicker.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <CloseIcon />
      </button>
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="panelId"
        ref="panelRef"
        role="dialog"
        :aria-label="placeholders[0]"
        :class="[ns.e('panel'), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @keydown="onPanelKeydown"
        @mousedown="onPanelMousedown"
        @focusout="onFocusout"
      >
        <div :class="ns.e('body')">
          <div v-if="shortcuts?.length" :class="ns.e('shortcuts')">
            <button
              v-for="shortcut in shortcuts"
              :key="shortcut.label"
              type="button"
              :class="ns.e('shortcut')"
              @click="pickShortcut(shortcut)"
            >
              {{ shortcut.label }}
            </button>
          </div>
          <DouCalendar
            ref="calendar"
            :model-value="calendarValue"
            :type="calendarType"
            :range="isRange"
            :min="min"
            :max="max"
            :disabled-date="disabledDate"
            :week-start="weekStart"
            :panels="panels"
            @select="onCalendarSelect"
          >
            <template v-if="!isDateTime && (slots.footer || showToday)" #footer>
              <slot name="footer" :pick="pick">
                <DouButton variant="ghost" size="sm" @click="pick(today())">
                  {{ t('datePicker.today') }}
                </DouButton>
              </slot>
            </template>
          </DouCalendar>
          <div v-if="isDateTime" :class="[ns.e('times'), 'dou-time-picker__body']">
            <TimeColumns
              v-for="(time, index) in draftTimes"
              :key="index"
              :value="time"
              :seconds="seconds"
              :steps="[1, 1, 1]"
              :label="
                isRange ? t(index ? 'timePicker.end' : 'timePicker.start') : t('datePicker.time')
              "
              @pick="onTimePick(index, $event)"
            />
          </div>
        </div>
        <div v-if="isDateTime" :class="ns.e('footer')">
          <slot name="footer" :pick="pick" />
          <DouButton v-if="showNow" variant="ghost" size="sm" @click="pickNow">
            {{ t('datePicker.now') }}
          </DouButton>
          <DouButton size="sm" :disabled="!canConfirm" @click="confirm">
            {{ t('datePicker.confirm') }}
          </DouButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
