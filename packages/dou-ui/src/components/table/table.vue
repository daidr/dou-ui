<script setup lang="ts" generic="T">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import type { CSSProperties } from 'vue'
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from '@dou-ui/icons'
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
  expandable: false,
  childrenKey: 'children',
  indent: 16,
  resizable: false,
  virtual: false,
})
const selected = defineModel<TableRowKey[]>('selected', { default: () => [] })
const sort = defineModel<TableSort | null>('sort', { default: null })
const expanded = defineModel<TableRowKey[]>('expanded', { default: () => [] })
const emit = defineEmits<{
  rowClick: [row: T, index: number, event: MouseEvent]
  columnResize: [key: string, width: number]
}>()
const slots = defineSlots<TableSlots<T>>()

const ns = useNamespace('table')
const { t, locale } = useLocale()
const size = useFormSize(() => props.size)
const id = `dou-table-${useId()}`

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

function childrenOf(row: T): T[] | undefined {
  const children = (row as Record<string, unknown>)[props.childrenKey]
  return Array.isArray(children) && children.length > 0 ? (children as T[]) : undefined
}

/** Numbers by value, everything else by its text in the page's language. */
function compareValues(a: unknown, b: unknown, name: string): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), name, { numeric: true })
}

// sorting: every level of a tree is sorted among its siblings
const sorter = computed(() => {
  const current = sort.value
  const column = current && props.columns.find((col) => col.key === current.key)
  if (props.manualSort || !current || !column?.sortable) return undefined
  const direction = current.order === 'desc' ? -1 : 1
  const compare =
    typeof column.sortable === 'function'
      ? column.sortable
      : (a: T, b: T) => compareValues(valueOf(a, column), valueOf(b, column), locale.value.name)
  return (a: T, b: T) => compare(a, b) * direction
})

function sorted(rows: T[]): T[] {
  const compare = sorter.value
  // Sorting is stable, so equal rows keep the order they came in.
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  return compare ? [...rows].sort(compare) : rows
}

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

// tree and detail rows
const expandedSet = computed(() => new Set(expanded.value))
const isTree = computed(() => props.data.some((row) => !!childrenOf(row)))
const hasExpand = computed(() => props.expandable !== false && !props.virtual)
const canExpand = (row: T) =>
  typeof props.expandable === 'function' ? props.expandable(row) : !!props.expandable

function toggleExpanded(key: TableRowKey) {
  expanded.value = expandedSet.value.has(key)
    ? expanded.value.filter((item) => item !== key)
    : [...expanded.value, key]
}

interface FlatRow {
  row: T
  key: TableRowKey
  level: number
  /** Position among the rendered rows, counting from 0. */
  index: number
  parent: boolean
}

const rows = computed<FlatRow[]>(() => {
  const result: FlatRow[] = []
  const walk = (list: T[], level: number) => {
    for (const row of sorted(list)) {
      const key = keyOf(row)
      const children = childrenOf(row)
      result.push({ row, key, level, index: result.length, parent: !!children })
      if (children && expandedSet.value.has(key)) walk(children, level + 1)
    }
  }
  walk(props.data, 1)
  return result
})

/** Every row, collapsed tree rows included. */
const allRows = computed(() => {
  const result: T[] = []
  const walk = (list: T[]) => {
    for (const row of list) {
      result.push(row)
      const children = childrenOf(row)
      if (children) walk(children)
    }
  }
  walk(props.data)
  return result
})

// selection
const selectedSet = computed(() => new Set(selected.value))
const canSelect = (row: T) =>
  typeof props.selectable === 'function' ? props.selectable(row) : !!props.selectable
const selectableKeys = computed(() => allRows.value.filter(canSelect).map(keyOf))
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
const utilityCount = computed(() => (hasExpand.value ? 1 : 0) + (hasSelection.value ? 1 : 0))
const span = computed(() => props.columns.length + utilityCount.value)

// widths: resized columns keep their width in px
const UTILITY_WIDTH = 40
const resizedWidths = reactive<Record<string, number>>({})
const resized = ref(false)
const widthOf = (column: TableColumn<T>) => resizedWidths[column.key] ?? column.width
const numericWidth = (column: TableColumn<T>) => {
  const width = widthOf(column)
  if (typeof width === 'number') return width
  return typeof column.minWidth === 'number' ? column.minWidth : 120
}
const isResizable = (column: TableColumn<T>) => column.resizable ?? props.resizable

// fixed columns stick at the summed widths of the fixed columns before them
const hasFixedStart = computed(() => props.columns.some((column) => column.fixed === 'start'))
const hasFixed = computed(() => props.columns.some((column) => column.fixed))
const fixedOffsets = computed(() => {
  const offsets = new Map<string, { side: 'start' | 'end'; offset: number; edge: boolean }>()
  let start = hasFixedStart.value ? utilityCount.value * UTILITY_WIDTH : 0
  const starts = props.columns.filter((column) => column.fixed === 'start')
  for (const column of starts) {
    offsets.set(column.key, { side: 'start', offset: start, edge: column === starts.at(-1) })
    start += numericWidth(column)
  }
  let end = 0
  const ends = props.columns.filter((column) => column.fixed === 'end')
  for (let i = ends.length - 1; i >= 0; i--) {
    const column = ends[i]!
    offsets.set(column.key, { side: 'end', offset: end, edge: column === ends[0] })
    end += numericWidth(column)
  }
  return offsets
})

function fixedStyle(column: TableColumn<T>): CSSProperties | undefined {
  const fixed = fixedOffsets.value.get(column.key)
  if (!fixed) return undefined
  return fixed.side === 'start'
    ? { insetInlineStart: `${fixed.offset}px` }
    : { insetInlineEnd: `${fixed.offset}px` }
}

function fixedClass(column: TableColumn<T>) {
  const fixed = fixedOffsets.value.get(column.key)
  if (!fixed) return undefined
  return [ns.is(`fixed-${fixed.side}`, true), ns.is(`fixed-${fixed.side}-edge`, fixed.edge)]
}

/** The utility columns stick with the fixed start columns, side by side. */
const utilityFixed = (position: number) =>
  hasFixedStart.value
    ? {
        class: [
          ns.is('fixed-start', true),
          ns.is(
            'fixed-start-edge',
            position === utilityCount.value - 1 && !props.columns.some((c) => c.fixed === 'start'),
          ),
        ],
        style: { insetInlineStart: `${position * UTILITY_WIDTH}px` },
      }
    : { class: undefined, style: undefined }

// horizontal and vertical scrolling
const wrapper = useTemplateRef<HTMLElement>('wrapper')
const tableEl = useTemplateRef<HTMLElement>('table')
const scrollTop = ref(0)
const shadowStart = ref(false)
const shadowEnd = ref(false)
const viewport = ref(0)

function measureScroll() {
  const el = wrapper.value
  if (!el) return
  scrollTop.value = el.scrollTop
  viewport.value = el.clientHeight
  const max = el.scrollWidth - el.clientWidth
  // `scrollLeft` is negative in right-to-left pages.
  const left = Math.abs(el.scrollLeft)
  shadowStart.value = left > 0
  shadowEnd.value = left < max - 1
}

const observer = shallowRef<ResizeObserver>()
onMounted(() => {
  measureScroll()
  if (typeof ResizeObserver === 'undefined' || !wrapper.value) return
  observer.value = new ResizeObserver(measureScroll)
  observer.value.observe(wrapper.value)
  if (tableEl.value) observer.value.observe(tableEl.value)
})
onBeforeUnmount(() => observer.value?.disconnect())

// virtual rows: only those in view, with spacers standing in for the rest
const rowHeight = computed(
  () => props.rowHeight ?? { sm: 36, md: 44, lg: 52 }[size.value as 'sm' | 'md' | 'lg'] ?? 44,
)
const OVERSCAN = 6
const fallbackViewport = computed(() =>
  typeof props.maxHeight === 'number' ? props.maxHeight : 400,
)
const range = computed(() => {
  const count = rows.value.length
  if (!props.virtual) return { from: 0, to: count }
  const height = rowHeight.value
  const view = viewport.value || fallbackViewport.value
  return {
    from: Math.max(0, Math.floor(scrollTop.value / height) - OVERSCAN),
    to: Math.min(count, Math.ceil((scrollTop.value + view) / height) + OVERSCAN),
  }
})
const visibleRows = computed(() => rows.value.slice(range.value.from, range.value.to))
const spacerBefore = computed(() => range.value.from * rowHeight.value)
const spacerAfter = computed(() => (rows.value.length - range.value.to) * rowHeight.value)
watch(
  () => props.data,
  () => {
    // Fewer rows can leave the scroll position past the end.
    if (props.virtual) void nextTick(measureScroll)
  },
)

// column resizing
const MIN_WIDTH = 48
const minWidthOf = (column: TableColumn<T>) =>
  typeof column.minWidth === 'number' ? Math.max(column.minWidth, MIN_WIDTH) : MIN_WIDTH

/** Pin every column at its rendered width before the first resize, so only the dragged one moves. */
function freezeWidths() {
  if (resized.value) return
  const cells = tableEl.value?.querySelectorAll<HTMLElement>(`thead > tr > th[data-column-key]`)
  const measured = new Map<string, number>()
  for (const cell of cells ?? [])
    measured.set(cell.dataset.columnKey!, cell.getBoundingClientRect().width)
  for (const column of props.columns) {
    // Not laid out (e.g. hidden): fall back to the declared width.
    resizedWidths[column.key] ??= measured.get(column.key) || numericWidth(column)
  }
  resized.value = true
}

function setWidth(column: TableColumn<T>, width: number) {
  resizedWidths[column.key] = Math.max(minWidthOf(column), Math.round(width))
}

function onResizeStart(event: PointerEvent, column: TableColumn<T>) {
  if (event.button !== 0) return
  event.preventDefault()
  freezeWidths()
  const handle = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startWidth = numericWidth(column)
  const rtl = getComputedStyle(handle).direction === 'rtl'
  handle.setPointerCapture?.(event.pointerId)
  const move = (moveEvent: PointerEvent) => {
    const delta = (moveEvent.clientX - startX) * (rtl ? -1 : 1)
    setWidth(column, startWidth + delta)
  }
  const up = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
    handle.removeEventListener('pointercancel', up)
    emit('columnResize', column.key, numericWidth(column))
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
  handle.addEventListener('pointercancel', up)
}

function onResizeKey(event: KeyboardEvent, column: TableColumn<T>) {
  const step = event.shiftKey ? 32 : 8
  const delta = { ArrowRight: step, ArrowLeft: -step }[event.key]
  if (delta === undefined) return
  event.preventDefault()
  freezeWidths()
  const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === 'rtl'
  setWidth(column, numericWidth(column) + (rtl ? -delta : delta))
  emit('columnResize', column.key, numericWidth(column))
}

const tableStyle = computed(() => {
  if (!resized.value) return undefined
  const total =
    props.columns.reduce((sum, column) => sum + numericWidth(column), 0) +
    utilityCount.value * UTILITY_WIDTH
  return { width: `${total}px` }
})

// summary
const summaryValues = computed(() => (props.summary ? props.summary(allRows.value) : undefined))

const wrapperStyle = computed(() =>
  props.maxHeight === undefined ? undefined : { maxHeight: px(props.maxHeight) },
)

const fixedLayout = computed(
  () => props.virtual || hasFixed.value || props.resizable || props.columns.some(isResizable),
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('bordered', props.bordered),
  ns.is('striped', props.striped),
  ns.is('hoverable', props.hoverable),
  ns.is('loading', props.loading),
  ns.is('scroll', props.maxHeight !== undefined),
  ns.is('fixed-layout', fixedLayout.value),
  ns.is('virtual', props.virtual),
  ns.is('shadow-start', shadowStart.value),
  ns.is('shadow-end', shadowEnd.value),
])

const alignClass = (column: TableColumn<T>) =>
  column.align && column.align !== 'start' && ns.is(column.align)

const treeColumnKey = computed(() => (isTree.value ? props.columns[0]?.key : undefined))
const rowStyle = computed(() => (props.virtual ? { height: `${rowHeight.value}px` } : undefined))
</script>

<template>
  <div :class="classes">
    <div ref="wrapper" :class="ns.e('wrapper')" :style="wrapperStyle" @scroll="measureScroll">
      <table
        ref="table"
        :class="ns.e('table')"
        :style="tableStyle"
        :aria-busy="loading || undefined"
        :aria-rowcount="virtual ? rows.length + 1 : undefined"
      >
        <colgroup>
          <col v-if="hasExpand" :class="ns.e('col-utility')" />
          <col v-if="hasSelection" :class="ns.e('col-utility')" />
          <col
            v-for="column in columns"
            :key="column.key"
            :style="{ width: px(widthOf(column)), minWidth: px(column.minWidth) }"
          />
        </colgroup>
        <thead :class="ns.e('head')">
          <tr :aria-rowindex="virtual ? 1 : undefined">
            <th
              v-if="hasExpand"
              :class="[ns.e('cell'), ns.e('expand'), utilityFixed(0).class]"
              :style="utilityFixed(0).style"
              scope="col"
            >
              <span :class="ns.e('visually-hidden')">{{ t('table.expand') }}</span>
            </th>
            <th
              v-if="hasSelection"
              :class="[ns.e('cell'), ns.e('selection'), utilityFixed(hasExpand ? 1 : 0).class]"
              :style="utilityFixed(hasExpand ? 1 : 0).style"
              scope="col"
            >
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
              :data-column-key="column.key"
              :class="[
                ns.e('cell'),
                alignClass(column),
                ns.is('sortable', !!column.sortable),
                fixedClass(column),
              ]"
              :style="[{ minWidth: px(column.minWidth) }, fixedStyle(column)]"
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
                <span
                  :class="[ns.e('sort-icon'), sort?.key === column.key && ns.is(sort.order)]"
                  aria-hidden="true"
                >
                  <ChevronUpIcon :class="ns.e('sort-asc')" />
                  <ChevronDownIcon :class="ns.e('sort-desc')" />
                </span>
              </button>
              <span v-else :class="ns.e('title')">
                <slot :name="`header-${column.key}`" :column="column">
                  <slot name="header" :column="column">{{ column.title }}</slot>
                </slot>
              </span>
              <span
                v-if="isResizable(column)"
                :class="ns.e('resizer')"
                role="separator"
                aria-orientation="vertical"
                tabindex="0"
                :aria-label="t('table.resize', { column: column.title ?? column.key })"
                :aria-valuenow="Math.round(numericWidth(column))"
                :aria-valuemin="minWidthOf(column)"
                @pointerdown="onResizeStart($event, column)"
                @keydown="onResizeKey($event, column)"
                @click.stop
              />
            </th>
          </tr>
        </thead>
        <tbody :class="ns.e('body')">
          <tr v-if="virtual && spacerBefore > 0" :class="ns.e('spacer')" aria-hidden="true">
            <td :colspan="span" :style="{ height: `${spacerBefore}px` }" />
          </tr>
          <template v-for="item in visibleRows" :key="item.key">
            <tr
              :class="[
                ns.e('row'),
                ns.is('even', item.index % 2 === 1),
                ns.is('selected', hasSelection && selectedSet.has(item.key)),
                ns.is('expanded', expandedSet.has(item.key)),
              ]"
              :style="rowStyle"
              :aria-rowindex="virtual ? item.index + 2 : undefined"
              @click="emit('rowClick', item.row, item.index, $event)"
            >
              <td
                v-if="hasExpand"
                :class="[ns.e('cell'), ns.e('expand'), utilityFixed(0).class]"
                :style="utilityFixed(0).style"
                @click.stop
              >
                <button
                  v-if="canExpand(item.row)"
                  type="button"
                  :class="[ns.e('toggle'), ns.is('open', expandedSet.has(item.key))]"
                  :aria-expanded="expandedSet.has(item.key)"
                  :aria-controls="expandedSet.has(item.key) ? `${id}-${item.key}` : undefined"
                  :aria-label="t('table.expandRow')"
                  @click="toggleExpanded(item.key)"
                >
                  <ChevronRightIcon />
                </button>
              </td>
              <td
                v-if="hasSelection"
                :class="[ns.e('cell'), ns.e('selection'), utilityFixed(hasExpand ? 1 : 0).class]"
                :style="utilityFixed(hasExpand ? 1 : 0).style"
                @click.stop
              >
                <DouCheckbox
                  :model-value="selectedSet.has(item.key)"
                  :disabled="!canSelect(item.row)"
                  size="sm"
                  :aria-label="t('table.selectRow')"
                  @update:model-value="toggleRow(item.row, $event)"
                />
              </td>
              <td
                v-for="column in columns"
                :key="column.key"
                :class="[
                  ns.e('cell'),
                  alignClass(column),
                  ns.is('ellipsis', !!column.ellipsis),
                  fixedClass(column),
                ]"
                :style="fixedStyle(column)"
              >
                <span
                  v-if="column.key === treeColumnKey"
                  :class="ns.e('tree')"
                  :style="{ paddingInlineStart: `${(item.level - 1) * indent}px` }"
                >
                  <button
                    v-if="item.parent"
                    type="button"
                    :class="[ns.e('toggle'), ns.is('open', expandedSet.has(item.key))]"
                    :aria-expanded="expandedSet.has(item.key)"
                    :aria-label="t('table.expandRow')"
                    @click.stop="toggleExpanded(item.key)"
                  >
                    <ChevronRightIcon />
                  </button>
                  <span v-else :class="ns.e('toggle-space')" />
                  <span :class="ns.e('tree-content')">
                    <slot
                      :name="`cell-${column.key}`"
                      :row="item.row"
                      :column="column"
                      :value="valueOf(item.row, column)"
                      :index="item.index"
                    >
                      <slot
                        name="cell"
                        :row="item.row"
                        :column="column"
                        :value="valueOf(item.row, column)"
                        :index="item.index"
                      >
                        {{ valueOf(item.row, column) ?? '' }}
                      </slot>
                    </slot>
                  </span>
                </span>
                <slot
                  v-else
                  :name="`cell-${column.key}`"
                  :row="item.row"
                  :column="column"
                  :value="valueOf(item.row, column)"
                  :index="item.index"
                >
                  <slot
                    name="cell"
                    :row="item.row"
                    :column="column"
                    :value="valueOf(item.row, column)"
                    :index="item.index"
                  >
                    {{ valueOf(item.row, column) ?? '' }}
                  </slot>
                </slot>
              </td>
            </tr>
            <tr
              v-if="hasExpand && canExpand(item.row) && expandedSet.has(item.key)"
              :id="`${id}-${item.key}`"
              :class="ns.e('detail-row')"
            >
              <td :class="ns.e('detail')" :colspan="span">
                <slot name="expand" :row="item.row" :index="item.index" />
              </td>
            </tr>
          </template>
          <tr v-if="virtual && spacerAfter > 0" :class="ns.e('spacer')" aria-hidden="true">
            <td :colspan="span" :style="{ height: `${spacerAfter}px` }" />
          </tr>
          <tr v-if="rows.length === 0" :class="ns.e('empty-row')">
            <td :class="ns.e('empty')" :colspan="span">
              <slot name="empty">
                <DouEmpty v-if="!loading" size="sm" :title="emptyText" />
              </slot>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="summaryValues" :class="ns.e('foot')">
          <tr :class="ns.e('summary')" :aria-rowindex="virtual ? rows.length + 2 : undefined">
            <td
              v-if="hasExpand"
              :class="[ns.e('cell'), utilityFixed(0).class]"
              :style="utilityFixed(0).style"
            />
            <td
              v-if="hasSelection"
              :class="[ns.e('cell'), utilityFixed(hasExpand ? 1 : 0).class]"
              :style="utilityFixed(hasExpand ? 1 : 0).style"
            />
            <td
              v-for="column in columns"
              :key="column.key"
              :class="[
                ns.e('cell'),
                alignClass(column),
                ns.is('ellipsis', !!column.ellipsis),
                fixedClass(column),
              ]"
              :style="fixedStyle(column)"
            >
              {{ summaryValues[column.key] ?? '' }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div v-if="loading" :class="ns.e('loading')">
      <DouSpinner />
    </div>
  </div>
</template>
