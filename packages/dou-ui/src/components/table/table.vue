<script setup lang="ts" generic="T">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import DouCheckbox from '../checkbox/checkbox.vue'
import DouEmpty from '../empty/empty.vue'
import DouSpinner from '../spinner/spinner.vue'
import type { TableColumn, TableProps, TableRowKey, TableSlots, TableSort } from './table'

defineOptions({ name: 'DouTable' })

const props = withDefaults(defineProps<TableProps<T>>(), {
  rowKey: 'id',
  bordered: false,
  striped: false,
  hoverable: true,
  loading: false,
  selectable: false,
  manualSort: false,
})
const selected = defineModel<TableRowKey[]>('selected', { default: () => [] })
const sort = defineModel<TableSort | null>('sort', { default: null })
const emit = defineEmits<{ rowClick: [row: T, index: number, event: MouseEvent] }>()
const slots = defineSlots<TableSlots<T>>()

const ns = useNamespace('table')
const { t } = useLocale()
const size = useFormSize(() => props.size)

const px = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value

function keyOf(row: T): TableRowKey {
  return typeof props.rowKey === 'function'
    ? props.rowKey(row)
    : ((row as Record<string, unknown>)[props.rowKey] as TableRowKey)
}

function valueOf(row: T, column: TableColumn<T>): unknown {
  return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]
}

/** Numbers by value, everything else by its text in the page's language. */
function compareValues(a: unknown, b: unknown, locale: string): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), locale, { numeric: true })
}

const { locale } = useLocale()

const rows = computed(() => {
  const current = sort.value
  const column = current && props.columns.find((col) => col.key === current.key)
  if (props.manualSort || !current || !column?.sortable) return props.data
  const direction = current.order === 'desc' ? -1 : 1
  const compare =
    typeof column.sortable === 'function'
      ? column.sortable
      : (a: T, b: T) => compareValues(valueOf(a, column), valueOf(b, column), locale.value.name)
  // Sorting is stable, so equal rows keep the order they came in.
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  return [...props.data].sort((a, b) => compare(a, b) * direction)
})

function toggleSort(column: TableColumn<T>) {
  const current = sort.value?.key === column.key ? sort.value.order : undefined
  // ascending → descending → unsorted
  if (current === undefined) sort.value = { key: column.key, order: 'asc' }
  else if (current === 'asc') sort.value = { key: column.key, order: 'desc' }
  else sort.value = null
}

function ariaSort(column: TableColumn<T>) {
  if (!column.sortable) return undefined
  if (sort.value?.key !== column.key) return 'none'
  return sort.value.order === 'asc' ? 'ascending' : 'descending'
}

// selection
const selectedSet = computed(() => new Set(selected.value))
const canSelect = (row: T) =>
  typeof props.selectable === 'function' ? props.selectable(row) : !!props.selectable
const selectableKeys = computed(() => props.data.filter(canSelect).map(keyOf))
const selectedCount = computed(
  () => selectableKeys.value.filter((key) => selectedSet.value.has(key)).length,
)
const allSelected = computed(
  () => selectableKeys.value.length > 0 && selectedCount.value === selectableKeys.value.length,
)
const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value)

function toggleAll(checked: boolean) {
  const keys = new Set(selectableKeys.value)
  // Rows that are selected but cannot be toggled here stay selected.
  const kept = selected.value.filter((key) => !keys.has(key))
  selected.value = checked ? [...kept, ...selectableKeys.value] : kept
}

function toggleRow(row: T, checked: boolean) {
  const key = keyOf(row)
  selected.value = checked
    ? [...selected.value.filter((item) => item !== key), key]
    : selected.value.filter((item) => item !== key)
}

const hasSelection = computed(() => props.selectable !== false)
const span = computed(() => props.columns.length + (hasSelection.value ? 1 : 0))

const wrapperStyle = computed(() =>
  props.maxHeight === undefined ? undefined : { maxHeight: px(props.maxHeight) },
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('bordered', props.bordered),
  ns.is('striped', props.striped),
  ns.is('hoverable', props.hoverable),
  ns.is('loading', props.loading),
  ns.is('scroll', props.maxHeight !== undefined),
])

const alignClass = (column: TableColumn<T>) =>
  column.align && column.align !== 'start' && ns.is(column.align)
</script>

<template>
  <div :class="classes">
    <div :class="ns.e('wrapper')" :style="wrapperStyle">
      <table :class="ns.e('table')" :aria-busy="loading || undefined">
        <colgroup>
          <col v-if="hasSelection" :class="ns.e('col-selection')" />
          <col
            v-for="column in columns"
            :key="column.key"
            :style="{ width: px(column.width), minWidth: px(column.minWidth) }"
          />
        </colgroup>
        <thead :class="ns.e('head')">
          <tr>
            <th v-if="hasSelection" :class="[ns.e('cell'), ns.e('selection')]" scope="col">
              <DouCheckbox
                :model-value="allSelected"
                :indeterminate="someSelected"
                :disabled="selectableKeys.length === 0"
                size="sm"
                :aria-label="t('table.selectAll')"
                @update:model-value="toggleAll"
              />
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="[ns.e('cell'), alignClass(column), ns.is('sortable', !!column.sortable)]"
              :style="{ minWidth: px(column.minWidth) }"
              scope="col"
              :aria-sort="ariaSort(column)"
            >
              <button
                v-if="column.sortable"
                type="button"
                :class="[ns.e('sorter'), ns.is('sorted', sort?.key === column.key)]"
                @click="toggleSort(column)"
              >
                <span :class="ns.e('title')">
                  <slot :name="`header-${column.key}`" :column="column">
                    <slot name="header" :column="column">{{ column.title }}</slot>
                  </slot>
                </span>
                <svg
                  :class="[ns.e('sort-icon'), sort?.key === column.key && ns.is(sort.order)]"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path :class="ns.e('sort-asc')" d="M8 3.5l3 3.5H5z" />
                  <path :class="ns.e('sort-desc')" d="M8 12.5L5 9h6z" />
                </svg>
              </button>
              <span v-else :class="ns.e('title')">
                <slot :name="`header-${column.key}`" :column="column">
                  <slot name="header" :column="column">{{ column.title }}</slot>
                </slot>
              </span>
            </th>
          </tr>
        </thead>
        <tbody :class="ns.e('body')">
          <tr
            v-for="(row, index) in rows"
            :key="keyOf(row)"
            :class="[ns.e('row'), ns.is('selected', hasSelection && selectedSet.has(keyOf(row)))]"
            @click="emit('rowClick', row, index, $event)"
          >
            <td v-if="hasSelection" :class="[ns.e('cell'), ns.e('selection')]" @click.stop>
              <DouCheckbox
                :model-value="selectedSet.has(keyOf(row))"
                :disabled="!canSelect(row)"
                size="sm"
                :aria-label="t('table.selectRow')"
                @update:model-value="toggleRow(row, $event)"
              />
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              :class="[ns.e('cell'), alignClass(column), ns.is('ellipsis', !!column.ellipsis)]"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :column="column"
                :value="valueOf(row, column)"
                :index="index"
              >
                <slot
                  name="cell"
                  :row="row"
                  :column="column"
                  :value="valueOf(row, column)"
                  :index="index"
                >
                  {{ valueOf(row, column) ?? '' }}
                </slot>
              </slot>
            </td>
          </tr>
          <tr v-if="rows.length === 0" :class="ns.e('empty-row')">
            <td :class="ns.e('empty')" :colspan="span">
              <slot name="empty">
                <DouEmpty v-if="!loading" size="sm" :title="emptyText" />
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="loading" :class="ns.e('loading')">
      <DouSpinner />
    </div>
  </div>
</template>
