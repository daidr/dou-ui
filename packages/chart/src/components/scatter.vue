<script setup lang="ts">
import { scatterKind } from '../core/scatter'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartScatterProps } from '../types'

defineOptions({ name: 'DouChartScatter', render: renderNothing })

const props = defineProps<ChartScatterProps>()
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartScatter', (chart) =>
  chart.addSeries({ kind: scatterKind, props, el, hidden }),
)
</script>
