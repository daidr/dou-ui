<script setup lang="ts">
import { scatterKind } from '../core/scatter'
import { useChartPart, useOwnNode } from '../context'
import type { ChartScatterProps } from '../types'

defineOptions({ name: 'DouChartScatter' })

const props = defineProps<ChartScatterProps>()

const el = useOwnNode()
useChartPart('DouChartScatter', (chart) => chart.addSeries({ kind: scatterKind, props, el }))
</script>

<template></template>
