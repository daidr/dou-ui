<script setup lang="ts">
import {
  DouChart,
  DouChartArea,
  DouChartBar,
  DouChartLine,
  DouChartPie,
  DouChartTooltip,
} from '@dou-ui/chart'
import type { ChartSelectEvent } from '@dou-ui/chart'
import { computed } from 'vue'
import { useDashboardWidget } from '../widget/context'
import { filterValueOf, rowsOf } from '../widgets/shared'
import type { ChartWidgetProps } from './types'

defineOptions({ name: 'DouDashboardChartWidget' })

const { props, data, size, setFilter, ownFilters, widget } = useDashboardWidget<ChartWidgetProps>()
const rows = computed(() => rowsOf(data.value, props.value.path))
const kind = computed(() => props.value.kind ?? 'line')
const ys = computed(() => props.value.y ?? [])
const nameOf = (key: string) => props.value.labels?.[key] ?? key
/** The x this widget filters by, if any: the other bars fade. */
const picked = computed(() =>
  props.value.filter ? ownFilters.value[props.value.filter] : undefined,
)
/** Bars other than the picked one turn gray; a new function when the pick changes, so they draw again. */
const barColor = computed(() => {
  const value = picked.value
  const x = props.value.x ?? ''
  if (!props.value.filter || value === undefined) return undefined
  return (row: Record<string, unknown>) =>
    filterValueOf(row[x]) === value ? undefined : 'var(--dou-color-border-strong)'
})

function onSelect(event: ChartSelectEvent) {
  const key = props.value.filter
  if (!key) return
  const value = filterValueOf(event.x)
  if (value === picked.value) setFilter(key, undefined)
  else setFilter(key, value, { label: event.title ?? String(value) })
}
</script>

<template>
  <DouChart
    class="dou-dashboard-chart"
    :data="rows"
    :x="props.x"
    :height="size.height.value || 160"
    :horizontal="kind === 'bar' && props.horizontal"
    :legend="kind === 'pie' || ys.length > 1"
    :aria-label="widget.title"
    v-on="props.filter ? { select: onSelect } : {}"
  >
    <DouChartPie
      v-if="kind === 'pie'"
      :value="ys[0] ?? ''"
      :name="ys[0] ? nameOf(ys[0]) : undefined"
      :inner-radius="0.6"
    />
    <template v-else>
      <template v-for="y in ys" :key="y">
        <DouChartBar
          v-if="kind === 'bar'"
          :y="y"
          :name="nameOf(y)"
          :stack="props.stacked || undefined"
          :color="barColor"
        />
        <DouChartArea
          v-else-if="kind === 'area'"
          :y="y"
          :name="nameOf(y)"
          :stack="props.stacked || undefined"
        />
        <DouChartLine v-else :y="y" :name="nameOf(y)" />
      </template>
    </template>
    <DouChartTooltip />
  </DouChart>
</template>
