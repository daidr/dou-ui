<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartBrushEvent, ChartBrushProps, ChartInterval } from '../types'

defineOptions({ name: 'DouChartBrush', render: renderNothing })

const props = withDefaults(defineProps<ChartBrushProps>(), { dim: true })
const emit = defineEmits<{
  /** A stretch was selected (on release), or the selection let go: the stretch and the rows in it. */
  select: [event: ChartBrushEvent]
}>()
/** The stretch of x selected; `null` for none. */
const x = defineModel<ChartInterval | null>('x', { default: null })
/** The stretch of values selected; `null` for none. */
const y = defineModel<ChartInterval | null>('y', { default: null })

const el = useOwnNode()
useChartPart('DouChartBrush', (chart) =>
  chart.addBrush({ props, el, x, y, select: (event) => emit('select', event) }),
)
</script>
