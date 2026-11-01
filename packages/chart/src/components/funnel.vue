<script setup lang="ts">
import { funnelKind } from '../core/funnel'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartFunnelProps } from '../types'

defineOptions({ name: 'DouChartFunnel', render: renderNothing })

const props = defineProps<ChartFunnelProps>()
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartFunnel', (chart) => chart.addSeries({ kind: funnelKind, props, el, hidden }))
</script>
