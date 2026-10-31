<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartInterval } from '../types'

defineOptions({ name: 'DouChartRange', render: renderNothing })

/** The stretch of x shown; `null` for all of it. The same as `DouChartZoom`'s `v-model:x`. */
const x = defineModel<ChartInterval | null>({ default: null })

const el = useOwnNode()
useChartPart('DouChartRange', (chart) => chart.addRange({ props: {}, el, x }))
</script>
