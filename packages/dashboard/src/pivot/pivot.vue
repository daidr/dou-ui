<script setup lang="ts">
import { DouPivot } from '@dou-ui/pivot'
import type {
  PivotCellEvent,
  PivotConfig,
  PivotDimension,
  PivotExpose,
  PivotField,
} from '@dou-ui/pivot'
import { computed, shallowRef, watch } from 'vue'
import { useDashboardWidget } from '../widget/context'
import { filterValueOf, rowsOf } from '../widgets/shared'
import { pivotPropsOf } from './read-props'

defineOptions({ name: 'DouDashboardPivotWidget' })

defineProps<{ fields?: readonly PivotField[] }>()

const {
  props: raw,
  data,
  size,
  setFilter,
  ownFilters,
  editing,
  setProps,
  setWorkbook,
} = useDashboardWidget()
const props = computed(() => pivotPropsOf(raw.value))
const pivot = shallowRef<PivotExpose>()
// the export menu writes the table as it shows: merged heads, totals, number formats
setWorkbook(() => pivot.value?.toSheet({ name: '' }))
const rows = computed(() => rowsOf(data.value, props.value.path))
// sorting in the table works while viewing too; only while editing is it saved
const config = shallowRef<PivotConfig | undefined>(props.value.config)
// only a new config from the props replaces it, not a change to another prop
watch(
  () => raw.value.config,
  () => (config.value = props.value.config),
)
function onConfig(next: PivotConfig) {
  config.value = next
  if (editing.value) setProps({ config: next }, { group: 'pivot-config' })
}
const nameOf = (dimension: PivotDimension) =>
  typeof dimension === 'string' ? dimension : dimension.field

/** The groups this widget's filters picked, marked in the table. */
function pathOf(dimensions: readonly PivotDimension[] = [], filters: Record<string, unknown>) {
  const path: unknown[] = []
  for (const dimension of dimensions) {
    const value = filters[nameOf(dimension)]
    if (value === undefined) break
    path.push(value)
  }
  return path
}
const highlight = computed(() => {
  if (!props.value.filter) return undefined
  const filters = ownFilters.value
  return {
    row: pathOf(config.value?.rows, filters),
    column: pathOf(config.value?.columns, filters),
  }
})

/** One filter per field of a group's path; the fields past its end are cleared. */
function apply(
  dimensions: readonly PivotDimension[] = [],
  path: readonly unknown[],
  labels: string[],
) {
  dimensions.forEach((dimension, i) =>
    i < path.length
      ? setFilter(nameOf(dimension), filterValueOf(path[i]), { label: labels[i] })
      : setFilter(nameOf(dimension), undefined),
  )
}

/** Sets one filter per field of the clicked cell's groups; a total clears the deeper ones. */
function onCell(cell: PivotCellEvent) {
  if (!props.value.filter) return
  const { rows: rowDims, columns: columnDims } = config.value ?? {}
  apply(rowDims, cell.row, cell.labels.row)
  apply(columnDims, cell.column, cell.labels.column)
}
</script>

<template>
  <DouPivot
    ref="pivot"
    class="dou-dashboard-pivot"
    :bordered="false"
    :data="rows"
    :fields="fields"
    :config="config"
    :highlight="highlight"
    size="sm"
    :max-height="size.height.value || undefined"
    @update:config="onConfig"
    @cell-click="onCell"
  />
</template>
