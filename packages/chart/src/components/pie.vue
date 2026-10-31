<script setup lang="ts">
import { useChartPart, useOwnNode } from '../context'
import type { ChartPieProps, ChartPieSlots } from '../types'

defineOptions({ name: 'DouChartPie' })

const props = withDefaults(defineProps<ChartPieProps>(), { innerRadius: 0 })
const slots = defineSlots<ChartPieSlots>()

const el = useOwnNode()
// the chart draws the pie and shows the slot in its hole
useChartPart('DouChartPie', (chart) =>
  chart.addPie({ props, el, center: () => slots.default?.() as never }),
)
</script>

<template></template>
