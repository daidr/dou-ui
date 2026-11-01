<script setup lang="ts">
import { waterfallKind } from '../core/waterfall'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartWaterfallProps } from '../types'

defineOptions({ name: 'DouChartWaterfall', render: renderNothing })

const props = withDefaults(defineProps<ChartWaterfallProps>(), { connectors: true })
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartWaterfall', (chart) =>
  chart.addSeries({ kind: waterfallKind, props, el, hidden }),
)
</script>
