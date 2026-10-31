<script setup lang="ts">
import { useChartPart, useOwnNode } from '../context'
import type { ChartInterval, ChartZoomProps } from '../types'

defineOptions({ name: 'DouChartZoom' })

const props = defineProps<ChartZoomProps>()
/** The stretch of x shown; `null` for all of it. */
const x = defineModel<ChartInterval | null>('x', { default: null })
/** The stretch of values shown; `null` for all of them. */
const y = defineModel<ChartInterval | null>('y', { default: null })

const el = useOwnNode()
useChartPart('DouChartZoom', (chart) => chart.addZoom({ props, el, x, y }))
</script>

<template></template>
