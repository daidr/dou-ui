<script setup lang="ts">
import { DouSparkline, DouStatistic } from 'dou-ui'
import { computed } from 'vue'
import { format, useDashboardMessages } from '../locale'
import { useDashboardWidget } from '../widget/context'
import { statPropsOf } from './read-props'
import { numberOf, valueAt } from './shared'

defineOptions({ name: 'DouDashboardStatWidget' })

const { props: raw, data, size } = useDashboardWidget()
const props = computed(() => statPropsOf(raw.value))
const messages = useDashboardMessages()

// a fixed value and one read from the data follow the same rule: a number, or text that is one
const value = computed(() => {
  const { field, value: fixed } = props.value
  return (field ? numberOf(valueAt(data.value, field)) : fixed) ?? null
})
const delta = computed(() =>
  props.value.delta ? numberOf(valueAt(data.value, props.value.delta)) : undefined,
)
const deltaText = computed(() => {
  if (delta.value === undefined) return ''
  const percent = `${delta.value > 0 ? '+' : ''}${(delta.value * 100).toFixed(1)}%`
  return format(messages.value.deltaText, { value: percent })
})
const points = computed(() => {
  const list = props.value.trend ? valueAt(data.value, props.value.trend) : undefined
  return Array.isArray(list) ? list.map(numberOf).filter((n): n is number => n !== undefined) : []
})
/** The sparkline takes what the number leaves of the height, out to the card's edges. */
const sparkHeight = computed(() => Math.max(0, Math.floor(size.height.value - 56)))
</script>

<template>
  <div class="dou-dashboard-stat">
    <DouStatistic
      :value="value"
      :precision="props.precision"
      :prefix="props.prefix"
      :suffix="props.suffix"
      :trend="delta === undefined || delta === 0 ? undefined : delta > 0 ? 'up' : 'down'"
    >
      <template v-if="deltaText" #footer>{{ deltaText }}</template>
    </DouStatistic>
    <div v-if="points.length > 1 && sparkHeight >= 24" class="dou-dashboard-stat__spark">
      <DouSparkline
        :data="points"
        type="area"
        smooth
        :width="size.width.value + 32"
        :height="sparkHeight"
      />
    </div>
  </div>
</template>
