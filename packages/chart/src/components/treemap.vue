<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartTreemapProps } from '../types'

defineOptions({ name: 'DouChartTreemap', render: renderNothing })

const props = withDefaults(defineProps<ChartTreemapProps>(), {
  label: 'name',
  value: 'value',
  children: 'children',
  labels: true,
})

const el = useOwnNode()
useChartPart('DouChartTreemap', (chart) => chart.addTree({ shape: 'treemap', props, el }))
</script>
