<script setup lang="ts">
import { barKind } from '../core/bar'
import { useChartPart, useOwnNode } from '../context'
import type { ChartBarProps } from '../types'

defineOptions({ name: 'DouChartBar' })

const props = defineProps<ChartBarProps>()
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartBar', (chart) => chart.addSeries({ kind: barKind, props, el, hidden }))
</script>

<template></template>
