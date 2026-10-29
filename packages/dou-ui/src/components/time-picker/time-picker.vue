<script setup lang="ts">
import { ArrowRightIcon, ClockIcon, CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { InputHTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { formatTime, now, parseTime, snap } from './time'
import type { TimeParts } from './time'
import type { TimePickerExpose, TimePickerProps, TimeRange, TimeValue } from './time-picker'
import TimeColumns from './time-columns.vue'

// The panel is a second root, so attributes go to the field by hand.
defineOptions({ name: 'DouTimePicker', inheritAttrs: false })

const props = withDefaults(defineProps<TimePickerProps>(), {
  format: 'HH:mm',
  range: false,
  hourStep: 1,
  minuteStep: 1,
  secondStep: 1,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: 'body',
})
const model = defineModel<TimeValue | TimeRange | null>()
const emit = defineEmits<{ change: [value: TimeValue | TimeRange | null] }>()

const ns = useNamespace('time-picker')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const id = `dou-time-picker-${useId()}`
const panelId = `${id}-panel`

const steps = computed<[number, number, number]>(() => [
  props.hourStep,
  props.minuteStep,
  props.secondStep,
])
const seconds = computed(() => props.format === 'HH:mm:ss')
const fields = computed(() => (props.range ? 2 : 1))

const values = computed<string[]>(() => {
  const value = model.value
  if (!value) return []
  return Array.isArray(value) ? value : [value]
})
const parts = computed(() =>
  Array.from({ length: fields.value }, (_, index) => {
    const value = values.value[index]
    return value ? parseTime(value) : null
  }),
)

/* the text in the fields, kept apart from the value while typing */

const texts = ref<string[]>([])
const syncTexts = () => {
  texts.value = Array.from({ length: fields.value }, (_, index) => values.value[index] ?? '')
}
watch([values, fields], syncTexts, { immediate: true })

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function commit(value: TimeValue | TimeRange | null) {
  if (same(model.value, value)) return syncTexts()
  model.value = value
  emit('change', value)
  formItem?.trigger('change')
  texts.value =
    value === null ? texts.value.map(() => '') : Array.isArray(value) ? [...value] : [value]
}

const format = (value: TimeParts) => formatTime(snap(value, steps.value), props.format)
const ordered = (range: TimeRange): TimeRange =>
  range[0] <= range[1] ? range : [range[1], range[0]]

function commitParts(list: (TimeParts | null)[]) {
  if (!props.range) return commit(list[0] ? format(list[0]) : null)
  if (list.every((item) => !item)) return commit(null)
  const start = list[0] ?? list[1]!
  const end = list[1] ?? list[0]!
  commit([format(start), format(end)])
}

/** Turn what was typed into a value, or put the old text back. */
function commitTexts() {
  const parsed = texts.value.map((text) => (text.trim() ? parseTime(text) : undefined))
  if (parsed.every((value) => value === undefined)) {
    if (values.value.length) commit(null)
    return
  }
  if (parsed.some((value) => value === null || value === undefined)) return syncTexts()
  commitParts(parsed as TimeParts[])
  if (props.range && Array.isArray(model.value)) commit(ordered(model.value))
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

watch(open, (value) => {
  // a range picked out of order is put right once the panel closes
  if (!value && props.range && Array.isArray(model.value)) commit(ordered(model.value))
})

const fieldRef = useTemplateRef<HTMLElement>('field')
const columnsRef = useTemplateRef<{ focus: () => void }[]>('columns')

function show() {
  if (!disabled.value) open.value = true
}
function hide() {
  open.value = false
}
function focus() {
  fieldRef.value?.querySelector('input')?.focus()
}

function onPick(index: number, value: TimeParts) {
  const list = [...parts.value]
  list[index] = value
  // the other end of a new range starts out at the same time
  if (props.range && !list[1 - index]) list[1 - index] = value
  commitParts(list)
}

function pickNow() {
  const value = now()
  commitParts(props.range ? [value, value] : [value])
}

function confirm() {
  hide()
  focus()
}

/* typing */

function onKeydown(event: KeyboardEvent) {
  if (disabled.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    show()
    void nextTick(() => columnsRef.value?.[0]?.focus())
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (open.value) {
      commitTexts()
      hide()
    } else show()
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' && event.key !== 'Enter') return
  event.preventDefault()
  confirm()
}

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
  commitTexts()
  hide()
  formItem?.trigger('blur')
}

function clear() {
  commit(null)
  hide()
  focus()
}

const placeholders = computed(() =>
  props.range
    ? [props.startPlaceholder ?? t('timePicker.start'), props.endPlaceholder ?? t('timePicker.end')]
    : [props.placeholder ?? t('timePicker.placeholder')],
)

const inputAttrs = (index: number): InputHTMLAttributes => ({
  role: 'combobox',
  'aria-haspopup': 'dialog',
  'aria-expanded': open.value,
  'aria-controls': rendered.value ? panelId : undefined,
  'aria-invalid': invalid.value || undefined,
  'aria-required': formItem?.required.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
  'aria-label': props.range ? placeholders.value[index] : undefined,
})

const showClear = computed(() => props.clearable && !disabled.value && values.value.length > 0)

defineExpose<TimePickerExpose>({
  focus,
  blur: () => (document.activeElement as HTMLElement)?.blur(),
})
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      v-bind="$attrs"
      :class="[
        ns.b(),
        'dou-picker',
        `dou-picker--${size}`,
        ns.is('range', range),
        ns.is('open', open),
        ns.is('disabled', disabled),
        ns.is('invalid', invalid),
      ]"
      :role="range ? 'group' : undefined"
      :aria-labelledby="range ? formItem?.labelId : undefined"
      @mousedown="onFieldMousedown"
      @focusout="onFocusout"
    >
      <ClockIcon class="dou-picker__icon" />
      <template v-for="index in fields" :key="index">
        <ArrowRightIcon v-if="index === 2" :class="ns.e('separator')" />
        <input
          v-model="texts[index - 1]"
          v-bind="inputAttrs(index - 1)"
          :id="index === 1 ? formItem?.inputId : undefined"
          class="dou-picker__input"
          :class="ns.e('input')"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="placeholders[index - 1]"
          :disabled="disabled"
          @input="show"
          @keydown="onKeydown"
        />
      </template>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        class="dou-picker__clear"
        :aria-label="t('timePicker.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <CloseIcon />
      </button>
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="panelId"
        ref="panelRef"
        role="dialog"
        :aria-label="placeholders.join(' – ')"
        :class="[ns.e('panel'), 'dou-picker-panel', 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @keydown="onPanelKeydown"
        @mousedown="onPanelMousedown"
        @focusout="onFocusout"
      >
        <div :class="ns.e('body')">
          <TimeColumns
            v-for="index in fields"
            ref="columns"
            :key="index"
            :value="parts[index - 1] ?? null"
            :seconds="seconds"
            :steps="steps"
            :label="range ? placeholders[index - 1] : undefined"
            @pick="onPick(index - 1, $event)"
          />
        </div>
        <div :class="ns.e('footer')">
          <DouButton variant="ghost" size="sm" @click="pickNow">{{
            t('timePicker.now')
          }}</DouButton>
          <DouButton size="sm" @click="confirm">{{ t('timePicker.confirm') }}</DouButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
