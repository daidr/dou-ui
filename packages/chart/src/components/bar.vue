<script setup lang="ts">
import { barKind } from '../core/bar'
import { useChartPart, useOwnNode } from '../context'
import type { ChartBarProps } from '../types'

defineOptions({ name: 'DouChartBar' })

const props = defineProps<ChartBarProps>()

const el = useOwnNode()
useChartPart('DouChartBar', (chart) => chart.addSeries({ kind: barKind, props, el }))
</script>

<template></template>
