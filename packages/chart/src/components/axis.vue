<script setup lang="ts">
import { useChartPart, useOwnNode } from '../context'
import type { ChartAxisProps } from '../types'

defineOptions({ name: 'DouChartAxis' })

const props = withDefaults(defineProps<ChartAxisProps>(), {
  zero: undefined,
  nice: undefined,
  grid: undefined,
})

const el = useOwnNode()
useChartPart('DouChartAxis', (chart) => chart.addAxis({ props, el }))
</script>

<template></template>
