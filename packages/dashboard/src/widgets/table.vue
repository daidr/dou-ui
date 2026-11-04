<script setup lang="ts">
import { DouTable } from 'dou-ui'
import type { TableColumn } from 'dou-ui'
import { computed, onMounted, ref } from 'vue'
import { useDashboardWidget } from '../widget/context'
import { fieldsOf, rowsToWorkbook, rowsOf } from './shared'
import type { TableWidgetColumn, TableWidgetProps } from './types'

defineOptions({ name: 'DouDashboardTableWidget' })

const { props, data, size, setWorkbook } = useDashboardWidget<TableWidgetProps>()
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
/** The table's font, read once it is on the page, to measure texts with. */
const root = ref<{ $el: Element }>()
const font = ref('')
onMounted(() => {
  const cell = root.value?.$el.querySelector('td, th')
  if (cell) font.value = getComputedStyle(cell).font
})
let context: CanvasRenderingContext2D | null | undefined
/** How wide a text is in the table's font, or about how wide before it is known. */
function textWidth(text: string) {
  context ??=
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (context && font.value) {
    context.font = font.value
    return context.measureText(text).width
  }
  let width = 0
  for (const char of text) width += char.charCodeAt(0) > 0x2e7f ? 14 : 8.5
  return width
}
/** Room for the title and the first rows' texts, with the cell's padding; up to 240px. */
function minWidthOf(title: string, texts: unknown[]) {
  let widest = textWidth(title)
  for (const text of texts) widest = Math.max(widest, textWidth(String(text ?? '')))
  return Math.min(240, Math.ceil(widest) + 28)
}
const columns = computed<TableColumn[]>(() => {
  const first = rows.value[0]
  const list: TableWidgetColumn[] =
    props.value.columns ?? fieldsOf(rows.value).map((key) => ({ key }))
  return list.map(({ key, title }) => {
    const numeric = typeof first?.[key] === 'number'
    // numbers with digit groups, as in the stat widget
    const value = numeric
      ? (row: Record<string, unknown>) =>
          typeof row[key] === 'number' ? number.format(row[key] as number) : row[key]
      : undefined
    const sample = rows.value.slice(0, 20).map((row) => (value ? value(row) : row[key]))
    const least = minWidthOf(title || key, sample)
    return {
      key,
      title: title || key,
      align: numeric ? 'end' : undefined,
      ellipsis: true,
      // shares of the width follow the contents; never narrower than them
      width: least,
      minWidth: least,
      value,
    }
  })
})
// the export menu writes the rows as they are, numbers without digit groups
setWorkbook(() =>
  rowsToWorkbook(
    '',
    columns.value.map((column) => ({
      key: column.key as string,
      title: String(column.title),
      width: typeof column.width === 'number' ? column.width : undefined,
    })),
    rows.value,
  ),
)
</script>

<template>
  <DouTable
    ref="root"
    class="dou-dashboard-table"
    :bordered="false"
    :data="rows"
    :columns="columns"
    :row-key="rowKey"
    size="sm"
    :max-height="size.height.value || undefined"
    :virtual="rows.length > 100"
  />
</template>
