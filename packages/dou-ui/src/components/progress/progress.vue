<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { ProgressProps, ProgressSlots } from './progress'

defineOptions({ name: 'DouProgress' })

const props = withDefaults(defineProps<ProgressProps>(), {
  max: 100,
  tone: 'neutral',
  size: 'md',
  showValue: false,
})
defineSlots<ProgressSlots>()

const ns = useNamespace('progress')

const indeterminate = computed(() => props.value === undefined || Number.isNaN(props.value))
const percent = computed(() => {
  if (indeterminate.value || props.max <= 0) return 0
  return Math.min(100, Math.max(0, ((props.value as number) / props.max) * 100))
})

const classes = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.m(props.size),
  ns.is('indeterminate', indeterminate.value),
])
</script>

<template>
  <div
    :class="classes"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="indeterminate ? undefined : value"
  >
    <div :class="ns.e('track')">
      <div
        :class="ns.e('bar')"
        :style="indeterminate ? undefined : { transform: `translateX(${percent - 100}%)` }"
      />
    </div>
    <span v-if="showValue && !indeterminate" :class="ns.e('value')">
      <slot name="value" :value="value!" :percent="percent">{{ Math.round(percent) }}%</slot>
    </span>
  </div>
</template>
