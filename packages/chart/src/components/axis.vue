<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartAxisProps } from '../types'

defineOptions({ name: 'DouChartAxis', render: renderNothing })

const props = withDefaults(defineProps<ChartAxisProps>(), {
  zero: undefined,
  nice: undefined,
  grid: undefined,
})

const el = useOwnNode()
useChartPart('DouChartAxis', (chart) => chart.addAxis({ props, el }))
</script>
