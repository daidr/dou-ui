<script setup lang="ts">
import { ArrowRightIcon, CalendarIcon, ClockIcon, CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { Placement } from '../../composables/use-floating'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import type { Size } from '../../utils/types'
import { useLocale } from '../config-provider/use-config'
import DouCalendar from '../date-picker/calendar.vue'
import { inBounds, parseDate } from '../date-picker/date'
import type { CalendarExpose, DateRange, WeekStart } from '../date-picker/date-picker'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { formatTime, parseTime } from '../time-picker/time'
import type { TimeParts } from '../time-picker/time'
import TimeColumns from '../time-picker/time-columns.vue'
import {
  bounds,
  clampDay,
  fitsKind,
  formatSegment,
  fromValue,
  isHour12,
  parsePattern,
  stepValue,
  toValue,
  typeDigit,
} from './segments'
import type { Fields, SegmentKind, SegmentType } from './segments'
import { useTeleport } from '../../utils/teleport'

type Value = string | [string, string] | null

// The panel is a second root, so attributes go to the field by hand.
defineOptions({ name: 'DouSegmentField', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    kind: SegmentKind
    seconds?: boolean
    displayFormat?: string
    range?: boolean
    min?: string
    max?: string
    disabledDate?: (date: string) => boolean
    steps?: [number, number, number]
    picker?: boolean
    weekStart?: WeekStart
    size?: Size
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
    clearable?: boolean
    placement?: Placement
    teleport?: string | HTMLElement | false
  }>(),
  {
    seconds: false,
    range: false,
    steps: () => [1, 1, 1],
    picker: false,
    disabled: false,
    readonly: false,
    invalid: false,
    clearable: false,
    placement: 'bottom-start',
    teleport: undefined,
  },
)
const teleportTarget = useTeleport(() => props.teleport)
const model = defineModel<Value>()
const emit = defineEmits<{ change: [value: Value] }>()

const ns = useNamespace('input-date')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const panelId = `dou-input-date-${useId()}-panel`

const isTime = computed(() => props.kind === 'time')
const editable = computed(() => !disabled.value && !props.readonly)
const count = computed(() => (props.range ? 2 : 1))

/* the pattern */

const parts = computed(() => {
  const time = t(props.seconds ? 'inputDate.timeWithSeconds' : 'inputDate.time')
  const fallback =
    props.kind === 'time'
      ? time
      : props.kind === 'datetime'
        ? `${t('inputDate.date')} ${time}`
        : t(`inputDate.${props.kind}`)
  const given = props.displayFormat ? parsePattern(props.displayFormat) : null
  return given && fitsKind(given, props.kind, props.seconds) ? given : parsePattern(fallback)
})
const hour12 = computed(() => isHour12(parts.value))
const meridiems = computed<[string, string]>(() => [t('inputDate.am'), t('inputDate.pm')])

/* what is typed, kept apart from the value until every part is there */

const fields = ref<Fields[]>([])
// The digits typed into the focused part. While more could follow (a `1`
// in a month), the value is left as it was.
const active = ref<{ field: number; type: SegmentType } | null>(null)
const buffer = ref('')
const pending = ref(false)
const outOfRange = ref(false)

const list = computed<string[]>(() => {
  const value = model.value
  if (!value) return []
  return Array.isArray(value) ? value : [value]
})

const key = (value: Value | undefined) => JSON.stringify(value ?? null)
// The last value this field sent out, so it is not read back over what is typed.
let sent: string | undefined

function load() {
  fields.value = Array.from({ length: count.value }, (_, index) =>
    fromValue(props.kind, list.value[index], hour12.value),
  )
  buffer.value = ''
  pending.value = false
  outOfRange.value = false
}
watch([count, hour12, () => props.kind, () => props.seconds], load, { immediate: true })
watch(model, (value) => {
  if (key(value) !== sent) load()
})

const allowed = (value: string) => {
  if (isTime.value) return true
  const day = value.slice(0, 10)
  return inBounds(day, props.min, props.max) && !(day.length === 10 && props.disabledDate?.(day))
}

function sync() {
  // The value waits while more digits could still follow.
  if (pending.value) return
  const values = fields.value.map((item) => toValue(props.kind, item, props.seconds, hour12.value))
  let next: Value = null
  outOfRange.value = false
  if (values.every((value) => value !== null)) {
    if (!values.every(allowed)) outOfRange.value = true
    else if (!props.range) next = values[0]!
    else next = values[0]! <= values[1]! ? [values[0]!, values[1]!] : [values[1]!, values[0]!]
  }
  if (key(model.value) === key(next)) return
  sent = key(next)
  model.value = next
  emit('change', next)
  formItem?.trigger('change')
}

function setPart(field: number, type: SegmentType, value: number | null) {
  const next = [...fields.value]
  const item = { ...next[field]!, [type]: value }
  next[field] = type === 'year' || type === 'month' ? clampDay(item) : item
  fields.value = next
}

/** End the digits typed into the focused part. */
function finish() {
  if (!buffer.value && !pending.value) return
  buffer.value = ''
  pending.value = false
  sync()
}

/* the parts as shown */

const segmentBounds = (field: number, type: SegmentType) =>
  bounds(type, fields.value[field]!, hour12.value)

function text(field: number, type: SegmentType) {
  const current = active.value
  if (current?.field === field && current.type === type && buffer.value) return buffer.value
  const value = fields.value[field]?.[type] ?? null
  return value === null ? null : formatSegment(type, value, meridiems.value)
}

const fieldLabel = (field: number) => {
  if (!props.range) return ''
  if (isTime.value) return t(field ? 'timePicker.end' : 'timePicker.start')
  return t(field ? 'datePicker.end' : 'datePicker.start')
}
const segmentLabel = (field: number, type: SegmentType) =>
  [fieldLabel(field), t(`inputDate.labels.${type}`)].filter(Boolean).join(' ')

/* moving between parts */

const fieldRef = useTemplateRef<HTMLElement>('field')
const segments = () => [...(fieldRef.value?.querySelectorAll<HTMLElement>('[data-segment]') ?? [])]

function move(from: HTMLElement, delta: number) {
  finish()
  const all = segments()
  all[all.indexOf(from) + delta]?.focus()
}

/** Focus the first empty part, or the first part. */
function focus() {
  const all = segments()
  const empty = all.find((el) => {
    const field = Number(el.dataset.field)
    return fields.value[field]?.[el.dataset.type as SegmentType] === null
  })
  ;(empty ?? all[0])?.focus()
}

/* typing */

const stepOf = (type: SegmentType) =>
  type === 'hour'
    ? props.steps[0]
    : type === 'minute'
      ? props.steps[1]
      : type === 'second'
        ? props.steps[2]
        : 1
const pageSteps: Record<SegmentType, number> = {
  year: 10,
  month: 3,
  day: 7,
  hour: 6,
  minute: 10,
  second: 10,
  meridiem: 1,
}

function step(field: number, type: SegmentType, amount: number) {
  finish()
  const current = fields.value[field]![type]
  if (type === 'meridiem') {
    setPart(field, type, current === null ? (amount > 0 ? 0 : 1) : 1 - current)
  } else {
    const unit = stepOf(type)
    // An empty year starts at this year rather than at year 1.
    const start = type === 'year' && current === null ? new Date().getFullYear() : undefined
    const by =
      Math.abs(amount) > 1
        ? Math.sign(amount) * Math.max(1, Math.round(Math.abs(amount) / unit))
        : amount
    setPart(field, type, stepValue(type, current, by, segmentBounds(field, type), unit, start))
  }
  sync()
}

function setEdge(field: number, type: SegmentType, end: boolean) {
  finish()
  const [min, max] = segmentBounds(field, type)
  const unit = stepOf(type)
  setPart(field, type, end ? Math.floor(max / unit) * unit : min)
  sync()
}

const separators = /[\s\-/.:：,，年月日时分秒]/

function input(field: number, type: SegmentType, char: string, el: HTMLElement) {
  if (type === 'meridiem') {
    const lower = char.toLowerCase()
    const [am, pm] = meridiems.value
    const value = lower === 'a' || char === am[0] ? 0 : lower === 'p' || char === pm[0] ? 1 : null
    if (value !== null) {
      setPart(field, type, value)
      sync()
      move(el, 1)
    } else if (separators.test(char) && fields.value[field]![type] !== null) move(el, 1)
    return
  }
  if (/^\d$/.test(char)) {
    const typed = typeDigit(type, buffer.value, char, segmentBounds(field, type))
    setPart(field, type, typed.value)
    if (typed.done) {
      buffer.value = ''
      pending.value = false
      sync()
      if (typed.value !== null) move(el, 1)
    } else {
      buffer.value = typed.buffer
      pending.value = true
      sync()
    }
    return
  }
  // A separator moves on once the part has something in it.
  if (separators.test(char) && (buffer.value || fields.value[field]![type] !== null)) move(el, 1)
}

function erase(field: number, type: SegmentType, el: HTMLElement, backward: boolean) {
  if (backward && buffer.value.length > 1) {
    buffer.value = buffer.value.slice(0, -1)
    const [min, max] = segmentBounds(field, type)
    const value = Number(buffer.value)
    setPart(field, type, value >= min && value <= max ? value : null)
    pending.value = true
    sync()
    return
  }
  if (buffer.value || fields.value[field]![type] !== null) {
    buffer.value = ''
    pending.value = false
    setPart(field, type, null)
    sync()
    return
  }
  if (backward) move(el, -1)
}

function onKeydown(event: KeyboardEvent, field: number, type: SegmentType) {
  const el = event.currentTarget as HTMLElement
  if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    if (!props.picker) return
    event.preventDefault()
    if (event.key === 'ArrowDown') void openPanel(true)
    else hide()
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'PageUp':
    case 'PageDown': {
      event.preventDefault()
      if (!editable.value) return
      const up = event.key === 'ArrowUp' || event.key === 'PageUp'
      const amount = event.key.startsWith('Page') ? pageSteps[type] : 1
      step(field, type, up ? amount : -amount)
      return
    }
    case 'Home':
    case 'End':
      event.preventDefault()
      if (editable.value) setEdge(field, type, event.key === 'End')
      return
    case 'ArrowLeft':
    case 'ArrowRight':
      event.preventDefault()
      move(el, event.key === 'ArrowRight' ? 1 : -1)
      return
    case 'Backspace':
    case 'Delete':
      event.preventDefault()
      if (editable.value) erase(field, type, el, event.key === 'Backspace')
      return
    case 'Enter':
      if (open.value) {
        event.preventDefault()
        hide()
      }
      return
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        hide()
      }
      return
  }
  if (event.key.length === 1) {
    event.preventDefault()
    if (editable.value) input(field, type, event.key, el)
  }
}

// Soft keyboards report `Unidentified` keys and only say what was typed
// here. Nothing is ever let into the text itself.
function onBeforeinput(event: InputEvent, field: number, type: SegmentType) {
  event.preventDefault()
  if (!editable.value || event.isComposing) return
  const el = event.currentTarget as HTMLElement
  if (event.inputType.startsWith('delete')) {
    erase(field, type, el, event.inputType !== 'deleteContentForward')
  } else if (event.data) {
    for (const char of event.data) input(field, type, char, el)
  }
}

// An input method writes into the part before it can be stopped: take what
// it wrote, then put the part's own text back.
function onCompositionend(event: CompositionEvent, field: number, type: SegmentType) {
  const el = event.currentTarget as HTMLElement
  el.textContent = text(field, type) ?? t(`inputDate.placeholders.${type}`)
  if (!editable.value) return
  for (const char of event.data ?? '') input(field, type, char, el)
}

/** Read a pasted value in the plain format, e.g. `2026-10-29` or `9:30`. */
function readPasted(raw: string): string | null {
  const value = raw.trim()
  if (props.kind === 'time') {
    const time = parseTime(value)
    return time ? formatTime(time, props.seconds ? 'HH:mm:ss' : 'HH:mm') : null
  }
  if (props.kind !== 'datetime') return parseDate(value, props.kind)
  const [day = '', clock] = value.split(/\s*[\sT]\s*/)
  const date = parseDate(day, 'date')
  const time = clock === undefined ? null : parseTime(clock)
  return date && time ? `${date} ${formatTime(time, props.seconds ? 'HH:mm:ss' : 'HH:mm')}` : null
}

function onPaste(event: ClipboardEvent, field: number) {
  event.preventDefault()
  if (!editable.value) return
  const value = readPasted(event.clipboardData?.getData('text') ?? '')
  if (!value) return
  const next = [...fields.value]
  next[field] = fromValue(props.kind, value, hour12.value)
  fields.value = next
  buffer.value = ''
  pending.value = false
  sync()
}

function onSegmentFocus(field: number, type: SegmentType) {
  active.value = { field, type }
  buffer.value = ''
  pending.value = false
}

function onSegmentBlur() {
  finish()
  active.value = null
}

/* the panel */

const open = ref(false)
const popup = usePopup({
  open,
  trigger: 'manual',
  closeOnOutside: true,
  disabled,
  placement: () => props.placement,
  offset: 4,
})
const { triggerRef, panelRef, rendered, theme, placement: side, panelStyle } = popup
const calendarRef = useTemplateRef<CalendarExpose>('calendar')
const columnsRef = useTemplateRef<{ focus: () => void }[]>('columns')

function hide() {
  open.value = false
}

async function openPanel(focusPanel = false) {
  if (disabled.value || props.readonly) return
  open.value = true
  if (!focusPanel) return
  await nextTick()
  if (isTime.value) columnsRef.value?.[0]?.focus()
  else calendarRef.value?.focus()
}

function toggle() {
  if (open.value) hide()
  else void openPanel(true)
}

const calendarType = computed(() => (props.kind === 'datetime' ? 'date' : props.kind) as 'date')
const calendarValue = computed(() => {
  const days = fields.value.map((item) => toValue(calendarType.value, item, false, false))
  if (!props.range) return days[0] ?? null
  return days[0] && days[1] ? ([days[0], days[1]] as DateRange) : null
})

function onCalendarSelect(value: string | DateRange) {
  const days = Array.isArray(value) ? value : [value]
  fields.value = fields.value.map((item, index) => {
    const day = fromValue(calendarType.value, days[index], false)
    const next = { ...item, year: day.year, month: day.month, day: day.day }
    if (props.kind !== 'datetime' || next.hour !== null) return next
    // A day picked before a time starts at the start of the day; the end
    // of a range at its end.
    const end = props.range && index === 1
    const time = fromValue('time', end ? '23:59:59' : '00:00:00', hour12.value)
    return {
      ...next,
      hour: time.hour,
      minute: time.minute,
      second: time.second,
      meridiem: time.meridiem,
    }
  })
  buffer.value = ''
  pending.value = false
  sync()
  hide()
  focus()
}

const timeOf = (item: Fields): TimeParts | null => {
  const value = toValue('time', { ...item, second: item.second ?? 0 }, true, hour12.value)
  return value ? parseTime(value) : null
}
const panelTimes = computed(() => fields.value.map(timeOf))

function onTimePick(index: number, time: TimeParts) {
  const value = fromValue('time', formatTime(time, 'HH:mm:ss'), hour12.value)
  const next = [...fields.value]
  next[index] = {
    ...next[index]!,
    hour: value.hour,
    minute: value.minute,
    second: props.seconds ? value.second : null,
    meridiem: value.meridiem,
  }
  fields.value = next
  sync()
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' && !(isTime.value && event.key === 'Enter')) return
  event.preventDefault()
  hide()
  focus()
}

// Pressing the panel between its buttons keeps focus where it was.
function onPanelMousedown(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('button, input, select, textarea, [tabindex]')) {
    event.preventDefault()
  }
}

/* the field */

// Pressing the field between its parts lands in the first empty part.
function onFieldMousedown(event: MouseEvent) {
  if (disabled.value) return
  const target = event.target as HTMLElement
  if (target.closest('button, [data-segment]')) return
  event.preventDefault()
  focus()
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
  finish()
  hide()
  // A range typed back to front is shown in order once the field is left.
  if (model.value) load()
  formItem?.trigger('blur')
}

function clear() {
  fields.value = fields.value.map(() => fromValue(props.kind, null, hour12.value))
  buffer.value = ''
  pending.value = false
  sync()
  hide()
  void nextTick(focus)
}

const hasInput = computed(() =>
  fields.value.some((item) => Object.values(item).some((value) => value !== null)),
)
const showClear = computed(() => props.clearable && editable.value && hasInput.value)
const invalid = computed(() => props.invalid || outOfRange.value || !!formItem?.invalid.value)
const icon = computed(() => (isTime.value ? ClockIcon : CalendarIcon))

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('time', isTime.value),
  ns.is('range', props.range),
  ns.is('open', open.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', props.readonly),
  ns.is('invalid', invalid.value),
])

defineExpose({
  focus,
  blur: () => (document.activeElement as HTMLElement | null)?.blur(),
})
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      v-bind="$attrs"
      :id="formItem?.inputId"
      :class="classes"
      role="group"
      :aria-labelledby="formItem?.labelId"
      :aria-describedby="formItem?.describedBy.value"
      @mousedown="onFieldMousedown"
      @focusout="onFocusout"
    >
      <button
        v-if="picker"
        type="button"
        tabindex="-1"
        :class="[ns.e('icon'), ns.e('toggle')]"
        :aria-label="t(isTime ? 'inputDate.openTime' : 'inputDate.openCalendar')"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="rendered ? panelId : undefined"
        :disabled="disabled || readonly"
        @mousedown.prevent
        @click="toggle"
      >
        <component :is="icon" />
      </button>
      <component :is="icon" v-else :class="ns.e('icon')" />
      <template v-for="(_, field) in fields" :key="field">
        <ArrowRightIcon v-if="field === 1" :class="ns.e('separator')" />
        <span :class="ns.e('value')">
          <template v-for="(part, index) in parts" :key="index">
            <span
              v-if="part.type === 'literal'"
              :class="ns.e('literal')"
              aria-hidden="true"
              v-text="part.text"
            />
            <span
              v-else
              data-segment
              :data-field="field"
              :data-type="part.type"
              :class="[
                ns.e('segment'),
                ns.m(part.type),
                ns.is('placeholder', text(field, part.type) === null),
              ]"
              role="spinbutton"
              :tabindex="disabled ? undefined : 0"
              :contenteditable="editable ? 'true' : undefined"
              :inputmode="part.type === 'meridiem' ? 'text' : 'numeric'"
              spellcheck="false"
              autocorrect="off"
              autocapitalize="off"
              enterkeyhint="next"
              :aria-label="segmentLabel(field, part.type)"
              :aria-valuenow="fields[field]?.[part.type] ?? undefined"
              :aria-valuemin="segmentBounds(field, part.type)[0]"
              :aria-valuemax="segmentBounds(field, part.type)[1]"
              :aria-valuetext="text(field, part.type) ?? t('inputDate.empty')"
              :aria-invalid="invalid || undefined"
              :aria-readonly="readonly || undefined"
              :aria-disabled="disabled || undefined"
              :aria-required="formItem?.required.value || undefined"
              :aria-keyshortcuts="picker ? 'Alt+ArrowDown' : undefined"
              v-text="text(field, part.type) ?? t(`inputDate.placeholders.${part.type}`)"
              @keydown="onKeydown($event, field, part.type)"
              @beforeinput="onBeforeinput($event as InputEvent, field, part.type)"
              @compositionend="onCompositionend($event, field, part.type)"
              @paste="onPaste($event, field)"
              @focus="onSegmentFocus(field, part.type)"
              @blur="onSegmentBlur"
            />
          </template>
        </span>
      </template>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        :class="ns.e('clear')"
        :aria-label="t('inputDate.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <CloseIcon />
      </button>
    </div>
  </OnlyChild>
  <Teleport v-if="picker && rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="panelId"
        ref="panelRef"
        role="dialog"
        :aria-label="t(isTime ? 'inputDate.openTime' : 'inputDate.openCalendar')"
        :class="[
          isTime ? 'dou-time-picker__panel dou-picker-panel' : 'dou-date-picker__panel',
          'dou-floating',
        ]"
        :style="panelStyle"
        :data-placement="side"
        :data-dou-theme="theme"
        @keydown="onPanelKeydown"
        @mousedown="onPanelMousedown"
        @focusout="onFocusout"
      >
        <div v-if="isTime" class="dou-time-picker__body">
          <TimeColumns
            v-for="(time, index) in panelTimes"
            ref="columns"
            :key="index"
            :value="time"
            :seconds="seconds"
            :steps="steps"
            :label="range ? fieldLabel(index) : undefined"
            @pick="onTimePick(index, $event)"
          />
        </div>
        <DouCalendar
          v-else
          ref="calendar"
          :model-value="calendarValue"
          :type="calendarType"
          :range="range && calendarType === 'date'"
          :min="min"
          :max="max"
          :disabled-date="disabledDate"
          :week-start="weekStart"
          @select="onCalendarSelect"
        />
      </div>
    </Transition>
  </Teleport>
</template>
