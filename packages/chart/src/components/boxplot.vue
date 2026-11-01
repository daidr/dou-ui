<script setup lang="ts">
import { boxKind } from '../core/box'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartBoxplotProps } from '../types'

defineOptions({ name: 'DouChartBoxplot', render: renderNothing })

const props = defineProps<ChartBoxplotProps>()
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartBoxplot', (chart) => chart.addSeries({ kind: boxKind, props, el, hidden }))
</script>
