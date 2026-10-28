<script setup lang="ts">
import { computed, ref, useAttrs, useTemplateRef } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import type { SliderExpose, SliderProps, SliderValue } from './slider'

defineOptions({ name: 'DouSlider', inheritAttrs: false })

const props = withDefaults(defineProps<SliderProps>(), {
  range: false,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  invalid: false,
})
const model = defineModel<SliderValue>()
const emit = defineEmits<{ change: [value: SliderValue] }>()

const ns = useNamespace('slider')
const { t } = useLocale()
const { formItem } = useFormItem()
// The thumbs are not labelable elements, so the item labels them by id.
formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

// `aria-label` and `aria-labelledby` name the thumb of a single slider;
// everything else dresses the root.
const attrs = useAttrs()
const rootAttrs = computed(() => {
  if (props.range) return attrs
  const { 'aria-label': _label, 'aria-labelledby': _labelledby, ...rest } = attrs
  return rest
})

const railRef = useTemplateRef<HTMLElement>('rail')

const thumbEl = (index: number) =>
  railRef.value?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? undefined

function decimals(value: number) {
  const [digits = '', exponent] = String(value).split('e')
  const fraction = digits.split('.')[1]?.length ?? 0
  return Math.max(0, fraction - Number(exponent ?? 0))
}

/** Snap to the nearest step and keep within `[lower, upper]`. */
function snap(value: number, lower = props.min, upper = props.max) {
  const steps = Math.round((value - props.min) / props.step)
  const snapped = Number((props.min + steps * props.step).toFixed(decimals(props.step)))
  return Math.min(Math.max(snapped, lower), upper)
}

const values = computed<number[]>(() => {
  const value = model.value
  if (props.range) {
    const [a = props.min, b = props.max] = Array.isArray(value) ? value : [props.min, value]
    return [snap(Math.min(a, b)), snap(Math.max(a, b))]
  }
  return [snap(Array.isArray(value) ? value[0] : (value ?? props.min))]
})

const span = computed(() => props.max - props.min || 1)
const percent = (value: number) => ((value - props.min) / span.value) * 100

const fillStyle = computed(() => {
  const [first = props.min, second] = values.value
  const start = second === undefined ? 0 : percent(first)
  const end = percent(second ?? first)
  return { left: `${start}%`, width: `${end - start}%` }
})

const marks = computed(() => {
  const list = Object.entries(props.marks ?? {})
    .map(([key, label]) => ({ value: Number(key), label }))
    .filter((mark) => mark.value >= props.min && mark.value <= props.max)
  // `list` is a fresh array, sorting it in place is safe.
  // oxlint-disable-next-line unicorn/no-array-sort
  return list.sort((a, b) => a.value - b.value)
})

// The rail's rounded ends already mark the bounds.
const innerMarks = computed(() =>
  marks.value.filter((mark) => mark.value > props.min && mark.value < props.max),
)

function inFill(value: number) {
  const [first = props.min, second] = values.value
  return second === undefined ? value <= first : value >= first && value <= second
}

/** Where a thumb may go without passing the other one. */
function bounds(index: number): [number, number] {
  if (!props.range) return [props.min, props.max]
  const [first = props.min, second = props.max] = values.value
  return index === 0 ? [props.min, second] : [first, props.max]
}

function set(index: number, value: number) {
  const next = [...values.value]
  next[index] = snap(value, ...bounds(index))
  if (next[index] === values.value[index] && model.value !== undefined) return false
  model.value = props.range ? [next[0]!, next[1]!] : next[0]!
  return true
}

function commit() {
  if (model.value === undefined) return
  emit('change', model.value)
  formItem?.trigger('change')
}

// Pointer: pressing the rail moves the nearest thumb there, and the
// thumb follows the pointer until it is released.
const active = ref<number | null>(null)
let moved = false

function valueAt(clientX: number) {
  const rect = railRef.value?.getBoundingClientRect()
  if (!rect || rect.width === 0) return props.min
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  return props.min + ratio * span.value
}

function nearest(value: number) {
  const [first = props.min, second] = values.value
  if (second === undefined) return 0
  if (first === second) return value > first ? 1 : 0
  return Math.abs(value - first) <= Math.abs(value - second) ? 0 : 1
}

function onPointerdown(event: PointerEvent) {
  if (disabled.value || event.button !== 0) return
  event.preventDefault()
  const value = valueAt(event.clientX)
  const thumb = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  const index = thumb ? Number(thumb.dataset.index) : nearest(value)
  active.value = index
  // Pressing a thumb grabs it where it is; pressing the rail jumps.
  moved = thumb ? false : set(index, value)
  thumbEl(index)?.focus()
  railRef.value?.setPointerCapture?.(event.pointerId)
}

function onPointermove(event: PointerEvent) {
  if (active.value === null) return
  const value = valueAt(event.clientX)
  // Two thumbs on the same spot: the one that can go where the pointer
  // heads takes over.
  const [first, second] = values.value
  if (props.range && first === second && value !== first) {
    active.value = value < first! ? 0 : 1
    thumbEl(active.value)?.focus()
  }
  if (set(active.value, value)) moved = true
}

function onPointerup(event: PointerEvent) {
  if (active.value === null) return
  railRef.value?.releasePointerCapture?.(event.pointerId)
  active.value = null
  if (moved) commit()
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (disabled.value) return
  const value = values.value[index] ?? props.min
  const page = Math.max(props.step, Math.round(span.value / 10 / props.step) * props.step)
  const targets: Record<string, number> = {
    ArrowRight: value + props.step,
    ArrowUp: value + props.step,
    ArrowLeft: value - props.step,
    ArrowDown: value - props.step,
    PageUp: value + page,
    PageDown: value - page,
    Home: props.min,
    End: props.max,
  }
  if (!(event.key in targets)) return
  event.preventDefault()
  if (set(index, targets[event.key]!)) commit()
}

const groupLabelledBy = computed(
  () => (attrs['aria-labelledby'] as string | undefined) ?? formItem?.labelId,
)

const describe = (value: number) => (props.formatValue ? props.formatValue(value) : undefined)

const thumbs = computed(() =>
  values.value.map((value, index) => {
    const [lower, upper] = bounds(index)
    return {
      value,
      index,
      style: { left: `${percent(value)}%` },
      min: lower,
      max: upper,
      label: props.range
        ? t(index === 0 ? 'slider.start' : 'slider.end')
        : (attrs['aria-label'] as string | undefined),
      labelledBy: props.range
        ? undefined
        : ((attrs['aria-labelledby'] as string | undefined) ?? formItem?.labelId),
    }
  }),
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('range', props.range),
  ns.is('disabled', disabled.value),
  ns.is('invalid', invalid.value),
  ns.is('dragging', active.value !== null),
  ns.is(
    'marked',
    marks.value.some((mark) => mark.label),
  ),
  attrs.class,
])

defineExpose<SliderExpose>({
  focus: () => thumbEl(0)?.focus(),
  blur: () => {
    const focused = document.activeElement
    if (focused instanceof HTMLElement && railRef.value?.contains(focused)) focused.blur()
  },
})
</script>

<template>
  <div
    v-bind="rootAttrs"
    :class="classes"
    :style="attrs.style as StyleValue"
    :role="range ? 'group' : undefined"
    :aria-labelledby="range ? groupLabelledBy : undefined"
  >
    <div
      ref="rail"
      :class="ns.e('rail')"
      @pointerdown="onPointerdown"
      @pointermove="onPointermove"
      @pointerup="onPointerup"
      @pointercancel="onPointerup"
      @lostpointercapture="onPointerup"
    >
      <div :class="ns.e('fill')" :style="fillStyle" />
      <span
        v-for="mark in innerMarks"
        :key="mark.value"
        :class="[ns.e('dot'), ns.is('active', inFill(mark.value))]"
        :style="{ left: `${percent(mark.value)}%` }"
        aria-hidden="true"
      />
      <div
        v-for="thumb in thumbs"
        :key="thumb.index"
        :id="thumb.index === 0 ? formItem?.inputId : undefined"
        :class="[ns.e('thumb'), ns.is('active', active === thumb.index)]"
        :style="thumb.style"
        :data-index="thumb.index"
        role="slider"
        :tabindex="disabled ? -1 : 0"
        aria-orientation="horizontal"
        :aria-valuenow="thumb.value"
        :aria-valuemin="thumb.min"
        :aria-valuemax="thumb.max"
        :aria-valuetext="describe(thumb.value)"
        :aria-label="thumb.label"
        :aria-labelledby="thumb.labelledBy"
        :aria-describedby="formItem?.describedBy.value"
        :aria-disabled="disabled || undefined"
        :aria-invalid="invalid || undefined"
        @keydown="onKeydown($event, thumb.index)"
      />
    </div>
    <div v-if="marks.length" :class="ns.e('marks')" aria-hidden="true">
      <span
        v-for="mark in marks"
        :key="mark.value"
        :class="[ns.e('mark'), ns.is('active', inFill(mark.value))]"
        :style="{ left: `${percent(mark.value)}%` }"
      >
        {{ mark.label }}
      </span>
    </div>
  </div>
</template>
