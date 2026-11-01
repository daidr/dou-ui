<script setup lang="ts">
import { computed, reactive, toRefs } from 'vue'
import { yColumn } from '../core/data'
import { histogramBins, histogramKind } from '../core/histogram'
import { useChartPart, useOwnNode, renderNothing } from '../context'
import type { ChartHistogramProps } from '../types'

defineOptions({ name: 'DouChartHistogram', render: renderNothing })

const props = defineProps<ChartHistogramProps>()
/** Turned off in the legend. */
const hidden = defineModel<boolean>('hidden', { default: false })

const el = useOwnNode()
useChartPart('DouChartHistogram', (chart) => {
  // the bins are the series' rows: a bar at the middle of each, as tall as its count
  const bins = computed(() =>
    histogramBins(yColumn(props.data ?? chart.data() ?? [], props.value), {
      count: props.bins,
      step: props.step,
    }),
  )
  // the bars count rows: named so, not after the values counted
  const name = computed(() => props.name ?? chart.messages().count)
  const shown = reactive({ ...toRefs(props), name, data: bins, x: 'x', y: 'count' })
  return chart.addSeries({ kind: histogramKind, props: shown as never, el, hidden })
})
</script>
