<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, useTemplateRef, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import type { InputNumberExpose, InputNumberProps, InputNumberSlots } from './input-number'

defineOptions({ name: 'DouInputNumber', inheritAttrs: false })

const props = withDefaults(defineProps<InputNumberProps>(), {
  min: -Infinity,
  max: Infinity,
  step: 1,
  disabled: false,
  readonly: false,
  invalid: false,
  controls: true,
})
const model = defineModel<number | null>({ default: null })
const emit = defineEmits<{ change: [value: number | null, oldValue: number | null] }>()
const slots = defineSlots<InputNumberSlots>()

const ns = useNamespace('input-number')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const editable = computed(() => !disabled.value && !props.readonly)

const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  if (!formItem) return rest
  return {
    id: formItem.inputId,
    'aria-describedby': formItem.describedBy.value,
    'aria-required': formItem.required.value || undefined,
    ...rest,
  }
})

const inputRef = useTemplateRef<HTMLInputElement>('input')

function decimals(value: number) {
  const [digits = '', exponent] = String(value).split('e')
  const fraction = digits.split('.')[1]?.length ?? 0
  return Math.max(0, fraction - Number(exponent ?? 0))
}

// Round through the decimal notation, so 1.005 rounds to 1.01 and
// 0.1 + 0.2 lands on 0.3.
function round(value: number, places: number) {
  return Number(`${Math.round(Number(`${value}e${places}`))}e-${places}`)
}

const clamp = (value: number) => Math.min(Math.max(value, props.min), props.max)

function normalize(value: number) {
  return clamp(props.precision === undefined ? value : round(value, props.precision))
}

function format(value: number | null) {
  if (value === null || Number.isNaN(value)) return ''
  return props.precision === undefined ? String(value) : value.toFixed(props.precision)
}

/** `null` for an empty field, `NaN` for text that is not a number. */
function parse(text: string) {
  const trimmed = text.trim()
  if (trimmed === '') return null
  // Accept the full-width digits and signs an IME may produce.
  const ascii = trimmed
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
    .replace(/[．。]/g, '.')
    .replace(/[－−]/g, '-')
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(ascii) ? Number(ascii) : Number.NaN
}

// What the field shows. It follows the model, except while the user is
// typing something that is not a number yet, such as `-` or `1.`.
const text = ref(format(model.value))
// The value as of the last commit, reported as `oldValue` by `change`.
let committed = model.value

// A value that does not match the text came from outside, not from typing.
watch(model, (value) => {
  if (parse(text.value) === value) return
  text.value = format(value)
  committed = value
})

function commit(value: number | null) {
  model.value = value
  text.value = format(value)
  if (value !== committed) {
    const old = committed
    committed = value
    emit('change', value, old)
    formItem?.trigger('change')
  }
}

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  const value = parse(text.value)
  // Only report values that would survive the commit unchanged, so a
  // half-typed number never reaches the model out of range.
  if (value === null || (!Number.isNaN(value) && value === normalize(value))) {
    model.value = value
    formItem?.trigger('change', { lazy: true })
  }
}

function onChange() {
  const value = parse(text.value)
  commit(Number.isNaN(value) ? model.value : value === null ? null : normalize(value))
}

function onBlur() {
  onChange()
  formItem?.trigger('blur')
}

function stepBy(count: number) {
  if (!editable.value) return
  const parsed = parse(text.value)
  const from = parsed === null || Number.isNaN(parsed) ? (model.value ?? 0) : parsed
  const next = round(from + props.step * count, Math.max(decimals(from), decimals(props.step)))
  commit(normalize(next))
}

const canIncrease = computed(() => editable.value && (model.value ?? -Infinity) < props.max)
const canDecrease = computed(() => editable.value && (model.value ?? Infinity) > props.min)

function onKeydown(event: KeyboardEvent) {
  if (!editable.value) return
  const steps: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }
  if (event.key in steps) {
    event.preventDefault()
    stepBy(steps[event.key]!)
  } else if (event.key === 'Home' && Number.isFinite(props.min)) {
    event.preventDefault()
    commit(props.min)
  } else if (event.key === 'End' && Number.isFinite(props.max)) {
    event.preventDefault()
    commit(props.max)
  } else if (event.key === 'Enter') {
    onChange()
  }
}

// Holding a step button repeats the step, slowly at first.
let timer: ReturnType<typeof setTimeout> | undefined

function stopRepeat() {
  clearTimeout(timer)
  timer = undefined
}

function startRepeat(event: PointerEvent, count: number) {
  if (event.button !== 0) return
  stopRepeat()
  stepBy(count)
  // A button that reaches the limit turns disabled and may never see the
  // pointer go up, so listen on the window and stop at the limit too.
  window.addEventListener('pointerup', stopRepeat, { once: true })
  const repeat = (delay: number) => {
    timer = setTimeout(() => {
      if (!(count > 0 ? canIncrease.value : canDecrease.value)) return stopRepeat()
      stepBy(count)
      repeat(50)
    }, delay)
  }
  repeat(400)
}

onBeforeUnmount(stopRepeat)

function onMousedown(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === inputRef.value || target.closest('a, input, select, textarea')) return
  event.preventDefault()
  inputRef.value?.focus()
}

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', props.readonly),
  ns.is('invalid', invalid.value),
  ns.is('controls', props.controls),
  attrs.class,
])

defineExpose<InputNumberExpose>({
  get input() {
    return inputRef.value
  },
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  increase: (count = 1) => stepBy(count),
  decrease: (count = 1) => stepBy(-count),
})
</script>

<template>
  <span :class="classes" :style="attrs.style as StyleValue" @mousedown="onMousedown">
    <span v-if="slots.prefix" :class="[ns.e('affix'), ns.e('prefix')]">
      <slot name="prefix" />
    </span>
    <input
      ref="input"
      v-bind="inputAttrs"
      :class="ns.e('native')"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      role="spinbutton"
      :value="text"
      :disabled="disabled"
      :readonly="readonly"
      :aria-valuenow="model ?? undefined"
      :aria-valuemin="Number.isFinite(min) ? min : undefined"
      :aria-valuemax="Number.isFinite(max) ? max : undefined"
      :aria-invalid="invalid || undefined"
      @input="onInput"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <span v-if="slots.suffix" :class="[ns.e('affix'), ns.e('suffix')]">
      <slot name="suffix" />
    </span>
    <span v-if="controls" :class="ns.e('controls')">
      <button
        type="button"
        tabindex="-1"
        :class="[ns.e('step'), ns.e('decrease')]"
        :aria-label="t('inputNumber.decrease')"
        :disabled="!canDecrease"
        @mousedown.prevent
        @pointerdown="startRepeat($event, -1)"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2.5 6h7" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        tabindex="-1"
        :class="[ns.e('step'), ns.e('increase')]"
        :aria-label="t('inputNumber.increase')"
        :disabled="!canIncrease"
        @mousedown.prevent
        @pointerdown="startRepeat($event, 1)"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2.5 6h7M6 2.5v7" stroke-linecap="round" />
        </svg>
      </button>
    </span>
  </span>
</template>
