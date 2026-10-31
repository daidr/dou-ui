<script setup lang="ts">
import { DouTable } from 'dou-ui'
import type { TableColumn } from 'dou-ui'
import { computed } from 'vue'
import { useDashboardWidget } from '../widget/context'
import { fieldsOf, rowsOf } from './shared'
import type { TableWidgetColumn, TableWidgetProps } from './types'

defineOptions({ name: 'DouDashboardTableWidget' })

const { props, data, size } = useDashboardWidget<TableWidgetProps>()
const rows = computed(() => rowsOf(data.value, props.value.path))
/** Each row's key: its `rowKey` field, or its place in the list. */
const keys = computed(() => {
  const map = new WeakMap<object, string | number>()
  const field = props.value.rowKey
  rows.value.forEach((row, index) => map.set(row, field ? (row[field] as string | number) : index))
  return map
})
const rowKey = (row: Record<string, unknown>) => keys.value.get(row) ?? ''
const number = new Intl.NumberFormat()
const columns = computed<TableColumn[]>(() => {
  const first = rows.value[0]
  const list: TableWidgetColumn[] =
    props.value.columns ?? fieldsOf(rows.value).map((key) => ({ key }))
  return list.map(({ key, title }) => {
    const numeric = typeof first?.[key] === 'number'
    return {
      key,
      title: title || key,
      align: numeric ? 'end' : undefined,
      ellipsis: true,
      // numbers with digit groups, as in the stat widget
      value: numeric
        ? (row: Record<string, unknown>) =>
            typeof row[key] === 'number' ? number.format(row[key] as number) : row[key]
        : undefined,
    }
  })
})
</script>

<template>
  <DouTable
    class="dou-dashboard-table"
    :data="rows"
    :columns="columns"
    :row-key="rowKey"
    size="sm"
    :max-height="size.height.value || undefined"
    :virtual="rows.length > 100"
  />
</template>
