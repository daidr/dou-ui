<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartTooltipProps, ChartTooltipSlots } from '../types'

defineOptions({ name: 'DouChartTooltip', render: renderNothing })

const props = withDefaults(defineProps<ChartTooltipProps>(), { crosshair: true })
const slots = defineSlots<ChartTooltipSlots>()

const el = useOwnNode()
useChartPart('DouChartTooltip', (chart) =>
  chart.addTooltip({ props, el, content: () => slots.default }),
)
</script>
