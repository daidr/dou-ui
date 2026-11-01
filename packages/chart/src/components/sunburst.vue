<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartSunburstProps, ChartSunburstSlots } from '../types'

defineOptions({ name: 'DouChartSunburst', render: renderNothing })

const props = withDefaults(defineProps<ChartSunburstProps>(), {
  label: 'name',
  value: 'value',
  children: 'children',
  labels: true,
  innerRadius: 0.3,
})
const slots = defineSlots<ChartSunburstSlots>()

const el = useOwnNode()
useChartPart('DouChartSunburst', (chart) =>
  chart.addTree({
    shape: 'sunburst',
    props,
    el,
    center: () => slots.default?.() as never,
  }),
)
</script>
