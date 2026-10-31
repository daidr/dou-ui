<script setup lang="ts">
import { CloseIcon, MinusIcon, PlusIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, ref, useAttrs, useTemplateRef, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
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
  clearable: false,
})
const model = defineModel<number | null>({ default: null })
const emit = defineEmits<{ change: [value: number | null, oldValue: number | null]; clear: [] }>()
const slots = defineSlots<InputNumberSlots>()

const ns = useNamespace('input-number')
const { t, locale } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const editable = computed(() => !disabled.value && !readonly.value)

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

// How the value reads while the field is not being edited.
const formatter = computed(() => {
  const option = props.format
  if (!option) return undefined
  if (typeof option === 'function') return option
  const digits =
    props.precision === undefined
      ? {}
      : { minimumFractionDigits: props.precision, maximumFractionDigits: props.precision }
  const intl = new Intl.NumberFormat(locale.value.name, { ...digits, ...option })
  return (value: number) => intl.format(value)
})
const focused = ref(false)

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

// The plain text while editing, the formatted value otherwise.
const shown = computed(() =>
  focused.value || !formatter.value || model.value === null || Number.isNaN(model.value)
    ? text.value
    : formatter.value(model.value),
)

function onBlur() {
  focused.value = false
  onChange()
  formItem?.trigger('blur')
}

const showClear = computed(() => props.clearable && editable.value && model.value !== null)

function clear() {
  commit(null)
  emit('clear')
  inputRef.value?.focus()
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

// Holding a step key repeats the step, slowly at first.
let timer: ReturnType<typeof setTimeout> | undefined
// The key being held: 1 for increase, -1 for decrease, 0 for none.
const held = ref(0)

function stopRepeat() {
  clearTimeout(timer)
  timer = undefined
  held.value = 0
}

function startRepeat(count: number) {
  stopRepeat()
  if (!(count > 0 ? canIncrease.value : canDecrease.value)) return
  held.value = count
  stepBy(count)
  const repeat = (delay: number) => {
    timer = setTimeout(() => {
      // A key that reaches the limit turns disabled, so stop there.
      if (!(count > 0 ? canIncrease.value : canDecrease.value)) return stopRepeat()
      stepBy(count)
      repeat(50)
    }, delay)
  }
  repeat(400)
}

function onStepPointerdown(event: PointerEvent, count: number) {
  // Touch goes through the key pad below.
  if (event.pointerType === 'touch' || event.button !== 0) return
  startRepeat(count)
  // The pointer may come up over a key that turned disabled, so listen
  // on the window.
  window.addEventListener('pointerup', stopRepeat, { once: true })
}

// On touch the keys are too small to aim at, so the first press only
// enlarges them. Keeping the finger down and sliding onto a key steps
// with it, and the pad shrinks back as soon as that finger lifts. After a
// plain press the pad stays, later taps step as usual, and it shrinks back
// after a tap elsewhere or a short pause.
const COLLAPSE_DELAY = 2000
// How far a finger slides from where the pad opened before it counts.
const SLIDE_THRESHOLD = 6

const keysRef = useTemplateRef<HTMLElement>('keys')
const expanded = ref(false)
let idle: ReturnType<typeof setTimeout> | undefined

function onOutsidePointerdown(event: PointerEvent) {
  if (!keysRef.value?.contains(event.target as Node)) collapse()
}

function expand() {
  clearTimeout(idle)
  if (expanded.value) return
  expanded.value = true
  document.addEventListener('pointerdown', onOutsidePointerdown, true)
}

function collapse() {
  clearTimeout(idle)
  stopRepeat()
  expanded.value = false
  document.removeEventListener('pointerdown', onOutsidePointerdown, true)
}

/** The key under a finger at `y`: 1 above the middle, -1 below, 0 on the seam. */
function keyAt(y: number) {
  const box = keysRef.value!.getBoundingClientRect()
  const middle = box.top + box.height / 2
  return Math.abs(y - middle) <= 2 ? 0 : y < middle ? 1 : -1
}

function onKeysPointerdown(event: PointerEvent) {
  if (event.pointerType !== 'touch' || !editable.value) return
  // Keep the keyboard closed and the page still while the finger is down.
  event.preventDefault()
  const keys = event.currentTarget as HTMLElement
  keys.setPointerCapture?.(event.pointerId)
  const opened = !expanded.value
  expand()
  const startY = event.clientY
  let slid = !opened
  let stepped = false
  const follow = (y: number) => {
    slid ||= Math.abs(y - startY) >= SLIDE_THRESHOLD
    const count = slid ? keyAt(y) : 0
    if (count === held.value) return
    stepped ||= count !== 0
    if (count) startRepeat(count)
    else stopRepeat()
  }
  follow(startY)
  const move = (e: PointerEvent) => {
    if (e.pointerId === event.pointerId) follow(e.clientY)
  }
  const end = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    stopRepeat()
    keys.removeEventListener('pointermove', move)
    keys.removeEventListener('pointerup', end)
    keys.removeEventListener('pointercancel', end)
    // A press that opened the pad and slid to adjust is done when lifted.
    if (opened && stepped) return collapse()
    clearTimeout(idle)
    idle = setTimeout(collapse, COLLAPSE_DELAY)
  }
  keys.addEventListener('pointermove', move)
  keys.addEventListener('pointerup', end)
  keys.addEventListener('pointercancel', end)
}

watch(editable, (value) => value || collapse())

onBeforeUnmount(collapse)

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
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('controls', props.controls),
  ns.is('expanded', expanded.value),
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
      :value="shown"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :aria-valuenow="model ?? undefined"
      :aria-valuetext="formatter && model !== null ? formatter(model) : undefined"
      :aria-valuemin="Number.isFinite(min) ? min : undefined"
      :aria-valuemax="Number.isFinite(max) ? max : undefined"
      :aria-invalid="invalid || undefined"
      @input="onInput"
      @focus="focused = true"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <button
      v-if="showClear"
      type="button"
      tabindex="-1"
      :class="ns.e('clear')"
      :aria-label="t('inputNumber.clear')"
      @mousedown.prevent
      @click="clear"
    >
      <CloseIcon />
    </button>
    <span v-if="slots.suffix" :class="[ns.e('affix'), ns.e('suffix')]">
      <slot name="suffix" />
    </span>
    <span v-if="controls" :class="ns.e('controls')">
      <span ref="keys" :class="ns.e('keys')" @pointerdown="onKeysPointerdown">
        <button
          type="button"
          tabindex="-1"
          :class="[ns.e('step'), ns.e('increase'), ns.is('held', held === 1)]"
          :aria-label="t('inputNumber.increase')"
          :disabled="!canIncrease"
          @mousedown.prevent
          @pointerdown="onStepPointerdown($event, 1)"
          @pointerleave="$event.pointerType === 'touch' || stopRepeat()"
          @pointercancel="stopRepeat"
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          tabindex="-1"
          :class="[ns.e('step'), ns.e('decrease'), ns.is('held', held === -1)]"
          :aria-label="t('inputNumber.decrease')"
          :disabled="!canDecrease"
          @mousedown.prevent
          @pointerdown="onStepPointerdown($event, -1)"
          @pointerleave="$event.pointerType === 'touch' || stopRepeat()"
          @pointercancel="stopRepeat"
        >
          <MinusIcon />
        </button>
      </span>
    </span>
  </span>
</template>
