<script setup lang="ts">
import { lineKind } from '../core/line'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartLineProps } from '../types'

defineOptions({ name: 'DouChartLine', render: renderNothing })

const props = withDefaults(defineProps<ChartLineProps>(), { dots: 'auto' })
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartLine', (chart) => chart.addSeries({ kind: lineKind, props, el, hidden }))
</script>
