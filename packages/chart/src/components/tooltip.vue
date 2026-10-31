<script setup lang="ts">
import { useChartPart, useOwnNode } from '../context'
import type { ChartTooltipProps, ChartTooltipSlots } from '../types'

defineOptions({ name: 'DouChartTooltip' })

const props = withDefaults(defineProps<ChartTooltipProps>(), { crosshair: true })
const slots = defineSlots<ChartTooltipSlots>()

const el = useOwnNode()
useChartPart('DouChartTooltip', (chart) =>
  chart.addTooltip({ props, el, content: () => slots.default }),
)
</script>

<template></template>
