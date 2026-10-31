<script setup lang="ts">
import { areaKind } from '../core/line'
import { useChartPart, useOwnNode } from '../context'
import type { ChartAreaProps } from '../types'

defineOptions({ name: 'DouChartArea' })

const props = withDefaults(defineProps<ChartAreaProps>(), { dots: false })
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartArea', (chart) => chart.addSeries({ kind: areaKind, props, el, hidden }))
</script>

<template></template>
