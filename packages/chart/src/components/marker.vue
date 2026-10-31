<script setup lang="ts">
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartMarkerProps } from '../types'

defineOptions({ name: 'DouChartMarker', render: renderNothing })

const props = defineProps<ChartMarkerProps>()

const el = useOwnNode()
useChartPart('DouChartMarker', (chart) => chart.addMarker({ props, el }))
</script>
