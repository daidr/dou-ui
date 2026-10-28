<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { InputHTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import DouCalendar from './calendar.vue'
import { inBounds, parseDate, today } from './date'
import type {
  CalendarExpose,
  DatePickerExpose,
  DatePickerProps,
  DatePickerSlots,
  DateRange,
  DateValue,
} from './date-picker'

// The calendar is a second root, so attributes go to the field by hand.
defineOptions({ name: 'DouDatePicker', inheritAttrs: false })

const props = withDefaults(defineProps<DatePickerProps>(), {
  type: 'date',
  range: false,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: 'body',
})
const model = defineModel<DateValue | DateRange | null>()
const emit = defineEmits<{
  select: [value: DateValue | DateRange]
  change: [value: DateValue | DateRange | null]
}>()
const slots = defineSlots<DatePickerSlots>()

const ns = useNamespace('date-picker')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const id = `dou-date-picker-${useId()}`
const panelId = `${id}-panel`

const isRange = computed(() => props.range && props.type === 'date')

/* the text in the fields, kept apart from the value while typing */

const values = computed<string[]>(() => {
  const value = model.value
  if (!value) return []
  return Array.isArray(value) ? value : [value]
})
const texts = ref<string[]>([])
const syncTexts = () => {
  texts.value = isRange.value
    ? [values.value[0] ?? '', values.value[1] ?? '']
    : [values.value[0] ?? '']
}
watch([values, isRange], syncTexts, { immediate: true })

const allowed = (value: string) =>
  inBounds(value, props.min, props.max) && !(value.length === 10 && props.disabledDate?.(value))

const same = (a: DateValue | DateRange | null | undefined, b: DateValue | DateRange | null) =>
  JSON.stringify(a ?? null) === JSON.stringify(b)

function commit(value: DateValue | DateRange | null) {
  if (same(model.value, value)) return syncTexts()
  model.value = value
  emit('change', value)
  formItem?.trigger('change')
  // A bound value only arrives on the next render; show it now.
  texts.value =
    value === null ? texts.value.map(() => '') : Array.isArray(value) ? [...value] : [value]
}

/** Turn what was typed into a value, or put the old text back. */
function commitTexts() {
  const parsed = texts.value.map((text) => (text.trim() ? parseDate(text, props.type) : ''))
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
  disabled,
  placement: () => props.placement,
  offset: 4,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup

const calendarRef = useTemplateRef<CalendarExpose>('calendar')
const startRef = useTemplateRef<HTMLInputElement>('start')
const fieldRef = useTemplateRef<HTMLElement>('field')

function show() {
  if (disabled.value || open.value) return
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
  const value = parseDate(texts.value[index] ?? '', props.type)
  if (value) calendarRef.value?.show(value)
}

function onKeydown(event: KeyboardEvent) {
  if (disabled.value) return
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
  if (disabled.value) return
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
  const fallback =
    props.type === 'year'
      ? t('datePicker.yearPlaceholder')
      : props.type === 'month'
        ? t('datePicker.monthPlaceholder')
        : t('datePicker.placeholder')
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

const showClear = computed(() => props.clearable && !disabled.value && values.value.length > 0)
const showToday = computed(() => !isRange.value && props.type === 'date' && allowed(today()))

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('range', isRange.value),
  ns.is('open', open.value),
  ns.is('disabled', disabled.value),
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
      <svg
        :class="ns.e('icon')"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        aria-hidden="true"
      >
        <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" />
        <path d="M2.25 6.75h11.5M5.5 1.75v3M10.5 1.75v3" stroke-linecap="round" />
      </svg>
      <input
        ref="start"
        v-model="texts[0]"
        v-bind="inputAttrs(0)"
        :id="formItem?.inputId"
        :class="ns.e('input')"
        type="text"
        autocomplete="off"
        :placeholder="placeholders[0]"
        :disabled="disabled"
        @input="onInput(0)"
        @keydown="onKeydown"
      />
      <template v-if="isRange">
        <svg
          :class="ns.e('separator')"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.25"
          aria-hidden="true"
        >
          <path
            d="M3 8h10m0 0L9.5 4.5M13 8l-3.5 3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <input
          ref="end"
          v-model="texts[1]"
          v-bind="inputAttrs(1)"
          :class="ns.e('input')"
          type="text"
          autocomplete="off"
          :placeholder="placeholders[1]"
          :disabled="disabled"
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
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M5 5l6 6M11 5l-6 6" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-floating">
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
        <DouCalendar
          ref="calendar"
          :model-value="model"
          :type="type"
          :range="range"
          :min="min"
          :max="max"
          :disabled-date="disabledDate"
          :week-start="weekStart"
          :panels="panels"
          @select="onSelect"
        >
          <template v-if="slots.footer || showToday" #footer>
            <slot name="footer" :pick="pick">
              <DouButton variant="ghost" size="sm" @click="pick(today())">
                {{ t('datePicker.today') }}
              </DouButton>
            </slot>
          </template>
        </DouCalendar>
      </div>
    </Transition>
  </Teleport>
</template>
