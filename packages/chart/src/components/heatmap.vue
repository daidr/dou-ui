<script setup lang="ts">
import { heatmapKind } from '../core/heatmap'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartHeatmapProps } from '../types'

defineOptions({ name: 'DouChartHeatmap', render: renderNothing })

const props = defineProps<ChartHeatmapProps>()
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartHeatmap', (chart) =>
  chart.addSeries({ kind: heatmapKind, props, el, hidden }),
)
</script>
