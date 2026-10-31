<script setup lang="ts">
import { useChartPart, useOwnNode } from '../context'
import type { ChartInterval } from '../types'

defineOptions({ name: 'DouChartRange' })

/** The stretch of x shown; `null` for all of it. The same as `DouChartZoom`'s `v-model:x`. */
const x = defineModel<ChartInterval | null>({ default: null })

const el = useOwnNode()
useChartPart('DouChartRange', (chart) => chart.addRange({ props: {}, el, x }))
</script>

<template></template>
