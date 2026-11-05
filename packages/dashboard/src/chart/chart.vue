<script setup lang="ts">
import {
  DouChart,
  DouChartArea,
  DouChartBar,
  DouChartLine,
  DouChartPie,
  DouChartTooltip,
} from '@dou-ui/chart'
import type { ChartPointEvent } from '@dou-ui/chart'
import { computed, watch } from 'vue'
import { useDashboardWidget } from '../widget/context'
import { filterValueOf, rowsOf, rowsToWorkbook, textOf, textsOf } from '../widgets/shared'
import type { ChartWidgetProps } from './types'

defineOptions({ name: 'DouDashboardChartWidget' })

const { props, data, size, setFilter, ownFilters, widget, setWorkbook } =
  useDashboardWidget<ChartWidgetProps>()
const rows = computed(() => rowsOf(data.value, props.value.path))
const kind = computed(() => props.value.kind ?? 'line')
const ys = computed(() => textsOf(props.value.y))
const x = computed(() => textOf(props.value.x))
const filter = computed(() => textOf(props.value.filter))
const nameOf = (key: string) => textOf(props.value.labels?.[key]) ?? key
/** The x this widget filters by, if any: the other bars fade. */
const picked = computed(() => (filter.value ? ownFilters.value[filter.value] : undefined))
/** Bars other than the picked one turn gray; a new function when the pick changes, so they draw again. */
const barColor = computed(() => {
  const value = picked.value
  const field = x.value ?? ''
  if (!filter.value || value === undefined) return undefined
  return (row: Record<string, unknown>) =>
    filterValueOf(row[field]) === value ? undefined : 'var(--dou-color-border-strong)'
})

// the export menu writes the chart's data: a column for x, one for each series;
// a chart without its fields has no menu
const seriesKeys = computed(() => (kind.value === 'pie' ? ys.value.slice(0, 1) : ys.value))
const exportable = computed(() => !!x.value && seriesKeys.value.length > 0)
watch(
  exportable,
  (ok) =>
    setWorkbook(
      ok
        ? () => {
            const field = x.value!
            return rowsToWorkbook(
              '',
              [
                { key: field, title: nameOf(field) },
                ...seriesKeys.value.map((key) => ({ key, title: nameOf(key) })),
              ],
              rows.value,
            )
          }
        : null,
    ),
  { immediate: true },
)

function onSelect(event: ChartPointEvent) {
  const key = filter.value
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
    :x="x"
    :height="size.height.value || 160"
    :horizontal="kind === 'bar' && props.horizontal"
    :legend="kind === 'pie' || ys.length > 1"
    :aria-label="widget.title"
    v-on="filter ? { select: onSelect } : {}"
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
