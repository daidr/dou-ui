<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import type {
  SegmentedControlOption,
  SegmentedControlProps,
  SegmentedControlSlots,
  SegmentedControlValue,
} from './segmented-control'

defineOptions({ name: 'DouSegmentedControl' })

const props = withDefaults(defineProps<SegmentedControlProps>(), {
  disabled: false,
  block: false,
})
// An explicit default stops Vue from reading a missing value as `false`.
const model = defineModel<SegmentedControlValue | undefined>({ default: undefined })
const emit = defineEmits<{ change: [value: SegmentedControlValue] }>()
defineSlots<SegmentedControlSlots>()

const ns = useNamespace('segmented-control')

// Each option is a native radio, so the browser handles arrow keys and
// keeps a single option checked, the same as a radio group.
const id = useId()
const name = computed(() => props.name ?? `dou-segmented-${id}`)

const { formItem } = useFormItem()
formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

// A read-only control takes focus but cancels the click or arrow key that would pick.
function onClick(event: MouseEvent) {
  if (readonly.value) event.preventDefault()
}
function onKeydown(event: KeyboardEvent) {
  if (readonly.value && event.key.startsWith('Arrow')) event.preventDefault()
}

const options = computed<SegmentedControlOption[]>(() =>
  props.options.map((option) =>
    typeof option === 'object' ? option : { value: option, label: String(option) },
  ),
)

function select(option: SegmentedControlOption) {
  if (disabled.value || readonly.value || option.disabled || option.value === model.value) return
  model.value = option.value
  emit('change', option.value)
  formItem?.trigger('change')
}

// The selection is a raised block that slides between the options. Its
// box is measured from the selected option, unrounded, so it covers the
// option exactly even when `block` shares out fractional widths. Layout
// sizes are used instead of screen boxes, so a scaled or rotated ancestor
// does not shift it.
const rootRef = useTemplateRef<HTMLElement>('root')

function layoutWidth(element: HTMLElement) {
  const style = getComputedStyle(element)
  const width = Number.parseFloat(style.width)
  if (Number.isNaN(width)) return element.offsetWidth
  if (style.boxSizing === 'border-box') return width
  return (
    width +
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth)
  )
}
const indicator = ref<{ left: number; width: number } | null>(null)
// No slide for the first placement, only for later changes.
const settled = ref(false)

function measure() {
  const root = rootRef.value
  const index = options.value.findIndex((option) => option.value === model.value)
  const items = root ? [...root.querySelectorAll<HTMLElement>(`.${ns.e('item')}`)] : []
  const item = index < 0 ? undefined : items[index]
  if (!root || !item) {
    indicator.value = null
    return
  }
  // The options sit side by side from the padding edge.
  let left = Number.parseFloat(getComputedStyle(root).paddingLeft) || 0
  for (const before of items.slice(0, index)) left += layoutWidth(before)
  indicator.value = { left, width: layoutWidth(item) }
}

let observer: ResizeObserver | undefined

onMounted(() => {
  // Measured in the next frame, before it is painted: controls mounting
  // together then share one layout, instead of each forcing one in the
  // middle of mounting, which is slow on a page with many controls.
  requestAnimationFrame(() => {
    measure()
    requestAnimationFrame(() => (settled.value = true))
  })
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    observer = new ResizeObserver(() => measure())
    observer.observe(rootRef.value)
    for (const item of rootRef.value.children) observer.observe(item)
  }
})
onBeforeUnmount(() => observer?.disconnect())

watch([model, options, size], () => nextTick(measure), { deep: true })

const indicatorStyle = computed(() =>
  indicator.value
    ? { transform: `translateX(${indicator.value.left}px)`, width: `${indicator.value.width}px` }
    : { display: 'none' },
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('block', props.block),
  ns.is('disabled', disabled.value),
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('settled', settled.value),
])
</script>

<template>
  <div
    ref="root"
    :id="formItem?.inputId"
    :class="classes"
    role="radiogroup"
    :aria-disabled="disabled || undefined"
    :aria-labelledby="formItem?.labelId"
    :aria-describedby="formItem?.describedBy.value"
    :aria-invalid="invalid || undefined"
    :aria-readonly="readonly || undefined"
    :aria-required="formItem?.required.value || undefined"
  >
    <span :class="ns.e('indicator')" :style="indicatorStyle" aria-hidden="true" />
    <label
      v-for="option in options"
      :key="String(option.value)"
      :class="[
        ns.e('item'),
        ns.is('checked', option.value === model),
        ns.is('disabled', disabled || !!option.disabled),
      ]"
    >
      <input
        type="radio"
        :class="ns.e('native')"
        :name="name"
        :value="option.value"
        :checked="option.value === model"
        :disabled="disabled || option.disabled"
        @click="onClick"
        @keydown="onKeydown"
        @change="select(option)"
      />
      <span :class="ns.e('label')">
        <slot name="option" :option="option" :checked="option.value === model">
          {{ option.label ?? String(option.value) }}
        </slot>
      </span>
    </label>
  </div>
</template>
