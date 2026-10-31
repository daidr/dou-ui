<script setup lang="ts">
import { StarIcon } from '@dou-ui/icons'
import { computed, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import type { RateProps, RateSlots } from './rate'

defineOptions({ name: 'DouRate' })

const props = withDefaults(defineProps<RateProps>(), {
  max: 5,
  allowHalf: false,
  clearable: false,
  readonly: false,
  disabled: false,
  tone: 'neutral',
})
const model = defineModel<number>({ default: 0 })
const emit = defineEmits<{ change: [value: number] }>()
const slots = defineSlots<RateSlots>()

const ns = useNamespace('rate')
const { t } = useLocale()
const { formItem } = useFormItem()
formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const interactive = computed(() => !disabled.value && !readonly.value)

const step = computed(() => (props.allowHalf ? 0.5 : 1))
const round = (value: number) => Math.round(value / step.value) * step.value
const clamp = (value: number) => Math.min(props.max, Math.max(0, round(value)))

// While the pointer is over the stars they preview the score it points at.
const hovered = ref<number | null>(null)
const shown = computed(() => hovered.value ?? model.value)

/** How much of star `index` is filled, from 0 to 1. */
const fill = (index: number) => Math.min(1, Math.max(0, shown.value - index))

function set(value: number) {
  const next = clamp(value)
  if (next === model.value) return
  model.value = next
  emit('change', next)
  formItem?.trigger('change')
}

function pointed(event: MouseEvent, index: number) {
  if (!props.allowHalf) return index + 1
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ltr = getComputedStyle(event.currentTarget as HTMLElement).direction !== 'rtl'
  const offset = ltr ? event.clientX - rect.left : rect.right - event.clientX
  return index + (offset < rect.width / 2 ? 0.5 : 1)
}

function onMove(event: MouseEvent, index: number) {
  if (interactive.value) hovered.value = pointed(event, index)
}

function onClick(event: MouseEvent, index: number) {
  if (!interactive.value) return
  const value = pointed(event, index)
  set(props.clearable && value === model.value ? 0 : value)
  hovered.value = null
}

function onKeydown(event: KeyboardEvent) {
  if (!interactive.value) return
  let next: number
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      next = model.value + step.value
      break
    case 'ArrowLeft':
    case 'ArrowDown':
      next = model.value - step.value
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = props.max
      break
    default:
      if (/^\d$/.test(event.key)) next = Number(event.key)
      else return
  }
  event.preventDefault()
  set(next)
}

const valueText = computed(() => t('rate.value', { value: model.value, max: props.max }))
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.m(size),
      ns.m(tone),
      ns.is('disabled', disabled),
      ns.is('readonly', readonly),
    ]"
  >
    <div
      :id="formItem?.inputId"
      :class="ns.e('stars')"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="model"
      :aria-valuetext="valueText"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabel ? undefined : formItem?.labelId"
      :aria-describedby="formItem?.describedBy.value"
      :aria-readonly="readonly || undefined"
      :aria-disabled="disabled || undefined"
      @keydown="onKeydown"
      @mouseleave="hovered = null"
    >
      <span
        v-for="(_, index) in max"
        :key="index"
        :class="[ns.e('star'), ns.is('hovered', hovered !== null && index < Math.ceil(hovered))]"
        :style="{ '--dou-rate-fill': fill(index) }"
        aria-hidden="true"
        @mousemove="onMove($event, index)"
        @click="onClick($event, index)"
      >
        <span :class="ns.e('empty')">
          <slot name="icon" :index="index">
            <StarIcon />
          </slot>
        </span>
        <span :class="ns.e('full')">
          <slot name="icon" :index="index">
            <StarIcon />
          </slot>
        </span>
      </span>
    </div>
    <span v-if="slots.default" :class="ns.e('text')"><slot :value="shown" /></span>
  </div>
</template>
