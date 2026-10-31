<script setup lang="ts">
import { areaKind } from '../core/line'
import { useChartPart, useOwnNode } from '../context'
import type { ChartAreaProps } from '../types'

defineOptions({ name: 'DouChartArea' })

const props = withDefaults(defineProps<ChartAreaProps>(), { dots: false })

const el = useOwnNode()
useChartPart('DouChartArea', (chart) => chart.addSeries({ kind: areaKind, props, el }))
</script>

<template></template>
