<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { ProgressProps, ProgressSlots } from './progress'

defineOptions({ name: 'DouProgress' })

const props = withDefaults(defineProps<ProgressProps>(), {
  max: 100,
  tone: 'neutral',
  type: 'line',
  size: 'md',
  width: 96,
  showValue: false,
  textInside: false,
})
defineSlots<ProgressSlots>()

const ns = useNamespace('progress')

const indeterminate = computed(() => props.value === undefined || Number.isNaN(props.value))
const percent = computed(() => {
  if (indeterminate.value || props.max <= 0) return 0
  return Math.min(100, Math.max(0, ((props.value as number) / props.max) * 100))
})

/* rings: drawn in a 100-unit box, scaled to `width` */

const ring = computed(() => {
  const stroke = ((props.strokeWidth ?? { sm: 4, md: 6, lg: 8 }[props.size]) * 100) / props.width
  const radius = 50 - stroke / 2
  const length = 2 * Math.PI * radius
  // A gauge leaves a quarter open at the bottom and starts at its left end.
  const arc = props.type === 'dashboard' ? length * 0.75 : length
  const rotate = props.type === 'dashboard' ? 135 : -90
  return { stroke, radius, length, arc, rotate }
})
const barDash = computed(() => {
  const { arc, length } = ring.value
  if (indeterminate.value) return `${arc * 0.25} ${length}`
  return `${(arc * percent.value) / 100} ${length}`
})

const customColor = computed(() => {
  const { color } = props
  if (!color) return undefined
  if (typeof color === 'string') return color
  if (typeof color === 'function') return color(percent.value)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  const stops = [...color].sort((a, b) => a.percent - b.percent)
  return (stops.find((stop) => percent.value <= stop.percent) ?? stops.at(-1))?.color
})

const inside = computed(() => props.type === 'line' && props.textInside && !indeterminate.value)
// below this the bar is too short for its own label
const insideFits = computed(() => percent.value >= 12)

const classes = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.m(props.size),
  props.type !== 'line' && [ns.m('ring'), ns.m(props.type)],
  ns.is('indeterminate', indeterminate.value),
  ns.is('empty', !indeterminate.value && percent.value === 0),
  ns.is('text-inside', inside.value),
  ns.is('custom', !!customColor.value),
])
</script>

<template>
  <div
    :class="classes"
    :style="{
      ...(type === 'line' ? {} : { width: `${width}px`, height: `${width}px` }),
      '--dou-progress-tone': customColor,
    }"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="indeterminate ? undefined : value"
  >
    <div v-if="type === 'line'" :class="ns.e('track')">
      <div
        :class="ns.e('bar')"
        :style="indeterminate ? undefined : { transform: `translateX(${percent - 100}%)` }"
      />
      <span
        v-if="inside"
        :class="[ns.e('inner'), ns.is('outside', !insideFits)]"
        :style="{ left: `${percent}%` }"
      >
        <slot name="value" :value="value!" :percent="percent">{{ Math.round(percent) }}%</slot>
      </span>
    </div>
    <svg v-else :class="ns.e('svg')" viewBox="0 0 100 100" aria-hidden="true">
      <g :transform="`rotate(${ring.rotate} 50 50)`">
        <circle
          :class="ns.e('track')"
          cx="50"
          cy="50"
          :r="ring.radius"
          :stroke-width="ring.stroke"
          :stroke-dasharray="`${ring.arc} ${ring.length}`"
        />
        <circle
          :class="ns.e('bar')"
          cx="50"
          cy="50"
          :r="ring.radius"
          :stroke-width="ring.stroke"
          :stroke-dasharray="barDash"
        />
      </g>
    </svg>
    <span v-if="showValue && !indeterminate && !inside" :class="ns.e('value')">
      <slot name="value" :value="value!" :percent="percent">{{ Math.round(percent) }}%</slot>
    </span>
  </div>
</template>
