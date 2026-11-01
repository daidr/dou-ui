<script setup lang="ts">
import { radarKind } from '../core/radar'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartRadarProps } from '../types'

defineOptions({ name: 'DouChartRadar', render: renderNothing })

// `dots` left out is `undefined` (dots when there are few spokes), not `false`
const props = withDefaults(defineProps<ChartRadarProps>(), { dots: undefined })
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartRadar', (chart) => chart.addSeries({ kind: radarKind, props, el, hidden }))
</script>
