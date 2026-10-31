<script setup lang="ts">
import { useChartPart, useOwnNode } from '../context'
import type { ChartPieProps, ChartPieSlots } from '../types'

defineOptions({ name: 'DouChartPie' })

const props = withDefaults(defineProps<ChartPieProps>(), { innerRadius: 0 })
const slots = defineSlots<ChartPieSlots>()
/** The labels of the slices turned off in the legend. */
const hidden = defineModel<string[]>('hidden', { default: () => [] })

const el = useOwnNode()
// the chart draws the pie and shows the slot in its hole
useChartPart('DouChartPie', (chart) =>
  chart.addPie({ props, el, hidden, center: () => slots.default?.() as never }),
)
</script>

<template></template>
