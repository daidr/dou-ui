<script setup lang="ts">
import { computed, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouStatistic } from '../statistic'
import type { CountdownProps, CountdownSlots } from './countdown'
import { formatDuration, showsFraction } from './format'
import { useCountdown } from './use-countdown'

defineOptions({ name: 'DouCountdown' })

const props = withDefaults(defineProps<CountdownProps>(), { format: 'HH:mm:ss' })
const emit = defineEmits<{ finish: []; change: [remaining: number] }>()
const slots = defineSlots<CountdownSlots>()

const ns = useNamespace('countdown')

const { remaining } = useCountdown(() => props.value, {
  interval: () => (showsFraction(props.format) ? 31 : undefined),
  onFinish: () => emit('finish'),
})
watch(remaining, (value) => emit('change', value))

// Without fractions the display rounds up, so a minute-long countdown starts at 60, not 59.
const text = computed(() => {
  const left = showsFraction(props.format)
    ? remaining.value
    : Math.ceil(remaining.value / 1000) * 1000
  return formatDuration(left, props.format)
})
</script>

<template>
  <DouStatistic
    :class="ns.b()"
    role="timer"
    :title="title"
    :value="text"
    :prefix="prefix"
    :suffix="suffix"
  >
    <template v-if="slots.title" #title><slot name="title" /></template>
    <template v-if="slots.prefix" #prefix><slot name="prefix" /></template>
    <template v-if="slots.suffix" #suffix><slot name="suffix" /></template>
    <template v-if="slots.footer" #footer><slot name="footer" /></template>
  </DouStatistic>
</template>
