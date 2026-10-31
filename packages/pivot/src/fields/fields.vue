<script setup lang="ts" generic="Row = Record<string, unknown>">
import {
  DouButton,
  DouCheckbox,
  DouDrawer,
  DouDropdown,
  DouDropdownItem,
  DouDropdownRadioGroup,
  DouDropdownSub,
  DouInput,
  DouPopover,
  DouSortable,
  useBreakpoints,
} from 'dou-ui'
import {
  CalendarIcon,
  ChevronDownIcon,
  FilterIcon,
  HashIcon,
  LayoutThreeColumnsIcon,
  LayoutThreeRowsIcon,
  SearchIcon,
  SigmaIcon,
  TablePivotIcon,
  ToggleLeftIcon,
  TypeIcon,
} from '@dou-ui/icons'
import { computed, nextTick, onMounted, ref, useId, type Component } from 'vue'
import { resolveConfig, type PivotAggregator, type PivotResolvedField } from '../engine'
import { BUILTIN_AGGREGATORS } from '../engine/aggregate'
import { DATE_PERIODS, groupKey, type PivotGroupBy } from '../engine/group'
import type { PivotConfig, PivotDimension, PivotFieldType, PivotFilter } from '../engine/types'
import { valueLabel } from '../core/labels'
import { usePivotSource } from '../core/source'
import { format, usePivotMessages } from '../locale'
import type { PivotFieldsProps } from '../types'
import FilterList from './filter-list.vue'
import {
  areasOf,
  AREAS,
  configOf,
  isFiltering,
  moveItem,
  stepsFor,
  withAggregate,
  withDimension,
  withFilter,
  type PivotArea,
  type PivotAreas,
  type PivotFieldItem,
} from './model'

defineOptions({ name: 'DouPivotFields' })

const props = withDefaults(defineProps<PivotFieldsProps<Row>>(), { drawer: 'auto' })
const config = defineModel<PivotConfig>('config', { default: () => ({}) })

const messages = usePivotMessages(() => props.messages)
const source = usePivotSource(
  () => props.data,
  () => props.fields,
)
const group = `dou-pivot-fields-${useId()}`

// ---- the fields ----

const TYPE_ICON: Record<PivotFieldType, Component> = {
  string: TypeIcon,
  number: HashIcon,
  date: CalendarIcon,
  boolean: ToggleLeftIcon,
}
const AREA_ICON: Record<PivotArea, Component> = {
  filters: FilterIcon,
  columns: LayoutThreeColumnsIcon,
  rows: LayoutThreeRowsIcon,
  values: SigmaIcon,
}

const allFields = computed<PivotResolvedField<unknown>[]>(() => {
  const s = source.value
  // the source knows each listed field, and makes one up for any other key the config names
  return [...s.fields.values()] as PivotResolvedField<unknown>[]
})
const field = (name: string) => source.value.field(name) as PivotResolvedField<unknown>

const query = ref('')
const listItems = computed<PivotFieldItem[]>({
  get: () => {
    const q = query.value.trim().toLocaleLowerCase()
    return allFields.value
      .filter((f) => !q || f.label.toLocaleLowerCase().includes(q) || f.name.includes(q))
      .map((f, index): PivotFieldItem => ({
        key: `l:${f.name}`,
        kind: 'field',
        field: f.name,
        index,
      }))
  },
  // the list always shows every field: dragging one out copies it
  set: () => {},
})

const areas = computed(() => areasOf(config.value))
const used = computed(() => {
  const set = new Set<string>()
  for (const area of AREAS) for (const item of areas.value[area]) set.add(item.field)
  return set
})

// ---- moving fields ----

let pending: PivotAreas | null = null
/** One drop updates two lists (the one left and the one entered); both land in one change. */
function setArea(area: PivotArea, items: PivotFieldItem[]) {
  if (!pending) {
    pending = { ...areas.value }
    queueMicrotask(() => {
      const next = pending!
      pending = null
      config.value = configOf(next, config.value)
    })
  }
  pending[area] = items
}

const areaModel = (area: PivotArea) =>
  computed<PivotFieldItem[]>({
    get: () => areas.value[area],
    set: (items) => setArea(area, items),
  })
const models = Object.fromEntries(AREAS.map((a) => [a, areaModel(a)])) as Record<
  PivotArea,
  ReturnType<typeof areaModel>
>

const areaOf = (item: PivotFieldItem): PivotArea | null =>
  AREAS.find((a) => areas.value[a].some((i) => i.key === item.key)) ?? null

function moveTo(item: PivotFieldItem, to: PivotArea | null) {
  config.value = configOf(moveItem(areas.value, areaOf(item), item, to), config.value)
}

/** The checkbox in the list: adds a field where it fits (numbers to the values), or takes it out everywhere. */
function toggleField(name: string, on: boolean) {
  if (!on) {
    let next = areas.value
    for (const area of AREAS) next = { ...next, [area]: next[area].filter((i) => i.field !== name) }
    config.value = configOf(next, config.value)
    return
  }
  const item: PivotFieldItem = { key: `l:${name}`, kind: 'field', field: name, index: 0 }
  moveTo(item, field(name).type === 'number' ? 'values' : 'rows')
}

const itemLabel = (item: PivotFieldItem) => (item.field ? field(item.field).label : '')

// ---- what each chip shows ----

const resolved = computed(() => {
  try {
    return resolveConfig(source.value as never, config.value, { aggregators: aggregatorMap.value })
  } catch {
    return null
  }
})
const aggregatorMap = computed(() => {
  const map: Record<string, PivotAggregator> = {}
  for (const a of props.aggregators ?? []) map[a.name] = a
  return map
})

function chipText(item: PivotFieldItem) {
  if (item.kind !== 'value') return itemLabel(item)
  const value = resolved.value?.values[item.index]
  const given = config.value.values?.[item.index]
  if (!value) return item.field ? itemLabel(item) : messages.value.aggregates.count!
  return valueLabel(value, typeof given === 'object' ? given.label : undefined, messages.value)
}

const dimensionOf = (axis: 'rows' | 'columns', name: string) => {
  const d = (config.value[axis] ?? []).find((x) => (typeof x === 'string' ? x : x.field) === name)
  return (typeof d === 'string' ? { field: d } : d) as Exclude<PivotDimension, string> | undefined
}

const filterOf = (name: string) => config.value.filters?.[name]

/** Whether a field's values can be filtered from its chip (not a value: it sums the field up). */
const canFilter = (item: PivotFieldItem) => item.kind !== 'value' && !!item.field

// ---- the menus ----

const aggregatesFor = (name: string) => {
  const type = name ? field(name).type : 'string'
  const builtIn =
    type === 'number'
      ? ['sum', 'count', 'avg', 'min', 'max', 'distinct', 'median']
      : type === 'date'
        ? ['count', 'distinct', 'min', 'max']
        : ['count', 'distinct']
  const custom = (props.aggregators ?? [])
    .filter((a) => type === 'number' || a.input === 'value')
    .map((a) => a.name)
  return [...builtIn, ...custom.filter((n) => !builtIn.includes(n))]
}
const aggregateText = (name: string) =>
  messages.value.aggregates[name] ??
  aggregatorMap.value[name]?.label ??
  BUILTIN_AGGREGATORS[name]?.label ??
  name

const currentAggregate = (index: number) => resolved.value?.values[index]?.aggregate ?? 'count'

/** The groupings a field offers: periods for dates, round range sizes for numbers. */
function groupingsFor(name: string): { key: string; by: PivotGroupBy | null; text: string }[] {
  const f = field(name)
  const m = messages.value.fields
  const none = { key: '', by: null, text: m.noGroup }
  if (f.type === 'date')
    return [none, ...DATE_PERIODS.map((p) => ({ key: p, by: p, text: m.periods[p] }))]
  if (f.type !== 'number') return []
  const measure = source.value.measure(name)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < measure.length; i++) {
    const v = measure[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  const write = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 })
  return [
    none,
    ...stepsFor(min, max).map((step) => ({
      key: groupKey({ step }),
      by: { step },
      text: format(m.step, { step: write.format(step) }),
    })),
  ]
}

function onSort(axis: 'rows' | 'columns', name: string, order: string | number) {
  config.value = withDimension(config.value, axis, name, { sort: order as 'asc' | 'desc' })
}
function onGroup(axis: 'rows' | 'columns', name: string, key: string | number) {
  const option = groupingsFor(name).find((g) => g.key === key)
  if (!option) return
  config.value = withDimension(config.value, axis, name, { by: option.by })
}
function onSubtotal(axis: 'rows' | 'columns', name: string, on: boolean) {
  config.value = withDimension(config.value, axis, name, { subtotal: on })
}
function onAggregate(index: number, name: string | number) {
  config.value = withAggregate(config.value, index, String(name))
}

// ---- filters ----

const filterOpen = ref<string | null>(null)
function setFilterOpen(key: string, open: boolean) {
  if (open) filterOpen.value = key
  else if (filterOpen.value === key) filterOpen.value = null
}
function openFilter(item: PivotFieldItem) {
  // after the menu has closed and given focus back
  nextTick(() => (filterOpen.value = item.key))
}
const filterBy = (item: PivotFieldItem): PivotGroupBy | undefined => {
  if (item.kind === 'dimension') {
    const axis = areas.value.rows.some((i) => i.key === item.key) ? 'rows' : 'columns'
    return dimensionOf(axis, item.field)?.by
  }
  return filterOf(item.field)?.by
}
function applyFilter(item: PivotFieldItem, filter: PivotFilter | null) {
  config.value = withFilter(config.value, item.field, filter, item.kind === 'filter')
  filterOpen.value = null
}

// ---- a narrow screen ----

const breakpoints = useBreakpoints()
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const inDrawer = computed(() =>
  props.drawer === 'auto' ? mounted.value && !breakpoints.sm : props.drawer,
)
const drawerOpen = ref(false)

const areaTitle = (area: PivotArea) => messages.value.fields.areas[area]
/** Where else an item can go; a count of records has no field to group or filter by. */
const otherAreas = (item: PivotFieldItem) => {
  const here = areaOf(item)
  return AREAS.filter((a) => a !== here && (item.field || a === 'values'))
}
const axisOf = (item: PivotFieldItem) =>
  areas.value.rows.some((i) => i.key === item.key) ? ('rows' as const) : ('columns' as const)

const filtered = (item: PivotFieldItem) => isFiltering(filterOf(item.field))
</script>

<template>
  <div
    :class="inDrawer ? 'dou-pivot-fields-trigger' : 'dou-pivot-fields'"
    :role="inDrawer ? undefined : 'region'"
    :aria-label="inDrawer ? undefined : messages.fields.panel"
  >
    <DouButton v-if="inDrawer" size="sm" variant="outline" @click="drawerOpen = true">
      <template #prefix><TablePivotIcon aria-hidden="true" /></template>
      {{ messages.fields.open }}
    </DouButton>
    <component
      :is="inDrawer ? DouDrawer : 'div'"
      v-bind="
        inDrawer
          ? { open: drawerOpen, title: messages.fields.panel, placement: 'bottom', size: '80%' }
          : { class: 'dou-pivot-fields__inner' }
      "
      @update:open="drawerOpen = $event"
    >
      <div :class="inDrawer ? 'dou-pivot-fields is-in-drawer' : 'dou-pivot-fields__body'">
        <section class="dou-pivot-fields__list-part" :aria-label="messages.fields.list">
          <DouInput
            v-model="query"
            size="sm"
            type="search"
            clearable
            :placeholder="messages.fields.search"
            :aria-label="messages.fields.search"
          >
            <template #prefix><SearchIcon aria-hidden="true" /></template>
          </DouInput>
          <DouSortable
            v-model="listItems"
            class="dou-pivot-fields__list"
            :group="group"
            :animation="false"
            item-key="key"
            :item-label="(item) => itemLabel(item)"
          >
            <template #default="{ item }">
              <div class="dou-pivot-fields__field">
                <DouCheckbox
                  size="sm"
                  :model-value="used.has(item.field)"
                  :aria-label="itemLabel(item)"
                  @update:model-value="toggleField(item.field, !!$event)"
                />
                <component
                  :is="TYPE_ICON[field(item.field).type]"
                  class="dou-pivot-fields__type"
                  aria-hidden="true"
                />
                <span class="dou-pivot-fields__name">{{ itemLabel(item) }}</span>
              </div>
            </template>
            <template #empty>
              <p class="dou-pivot-fields__none">{{ messages.fields.noFields }}</p>
            </template>
          </DouSortable>
        </section>

        <div class="dou-pivot-fields__areas">
          <section
            v-for="area in AREAS"
            :key="area"
            class="dou-pivot-fields__area"
            :class="`is-${area}`"
            :aria-label="areaTitle(area)"
          >
            <h3 class="dou-pivot-fields__area-title">
              <component :is="AREA_ICON[area]" aria-hidden="true" />
              {{ areaTitle(area) }}
            </h3>
            <DouSortable
              v-model="models[area].value"
              class="dou-pivot-fields__chips"
              :group="group"
              item-key="key"
              :item-label="(item) => chipText(item)"
            >
              <template #default="{ item }">
                <div class="dou-pivot-fields__chip" :class="{ 'is-filtered': filtered(item) }">
                  <span class="dou-pivot-fields__chip-text">{{ chipText(item) }}</span>
                  <DouPopover
                    v-if="canFilter(item)"
                    :open="filterOpen === item.key"
                    placement="bottom-start"
                    :width="260"
                    @update:open="setFilterOpen(item.key, $event)"
                  >
                    <button
                      type="button"
                      class="dou-pivot-fields__chip-button"
                      :class="{ 'is-on': filtered(item) }"
                      :aria-label="
                        filtered(item)
                          ? `${messages.fields.filtered}，${format(messages.filter.title, { field: itemLabel(item) })}`
                          : format(messages.filter.title, { field: itemLabel(item) })
                      "
                    >
                      <FilterIcon aria-hidden="true" />
                    </button>
                    <template #content>
                      <!-- a fresh list each time it opens, picked as the filter is now -->
                      <FilterList
                        :key="filterOpen === item.key ? 'open' : 'closed'"
                        :source="source as never"
                        :field="item.field"
                        :by="filterBy(item)"
                        :filter="filterOf(item.field)"
                        :messages="messages"
                        @apply="applyFilter(item, $event)"
                        @cancel="filterOpen = null"
                      />
                    </template>
                  </DouPopover>
                  <DouDropdown placement="bottom-end">
                    <button
                      type="button"
                      class="dou-pivot-fields__chip-button"
                      :aria-label="format(messages.fields.menu, { field: chipText(item) })"
                    >
                      <ChevronDownIcon aria-hidden="true" />
                    </button>
                    <template #menu>
                      <template v-if="item.kind === 'dimension'">
                        <DouDropdownSub :title="messages.fields.sort">
                          <DouDropdownRadioGroup
                            :model-value="dimensionOf(axisOf(item), item.field)?.sort ?? 'asc'"
                            @update:model-value="onSort(axisOf(item), item.field, $event!)"
                          >
                            <DouDropdownItem value="asc">{{ messages.fields.asc }}</DouDropdownItem>
                            <DouDropdownItem value="desc">{{
                              messages.fields.desc
                            }}</DouDropdownItem>
                          </DouDropdownRadioGroup>
                        </DouDropdownSub>
                        <DouDropdownSub
                          v-if="groupingsFor(item.field).length"
                          :title="messages.fields.groupBy"
                        >
                          <DouDropdownRadioGroup
                            :model-value="groupKey(dimensionOf(axisOf(item), item.field)?.by)"
                            @update:model-value="onGroup(axisOf(item), item.field, $event!)"
                          >
                            <DouDropdownItem
                              v-for="option in groupingsFor(item.field)"
                              :key="option.key"
                              :value="option.key"
                              >{{ option.text }}</DouDropdownItem
                            >
                          </DouDropdownRadioGroup>
                        </DouDropdownSub>
                        <DouDropdownItem
                          :checked="dimensionOf(axisOf(item), item.field)?.subtotal !== false"
                          @update:checked="onSubtotal(axisOf(item), item.field, $event)"
                          >{{ messages.fields.subtotal }}</DouDropdownItem
                        >
                      </template>
                      <template v-if="item.kind === 'value'">
                        <DouDropdownSub :title="messages.fields.aggregate">
                          <DouDropdownRadioGroup
                            :model-value="currentAggregate(item.index)"
                            @update:model-value="onAggregate(item.index, $event!)"
                          >
                            <DouDropdownItem
                              v-for="name in aggregatesFor(item.field)"
                              :key="name"
                              :value="name"
                              >{{ aggregateText(name) }}</DouDropdownItem
                            >
                          </DouDropdownRadioGroup>
                        </DouDropdownSub>
                        <DouDropdownItem
                          v-if="(config.values?.length ?? 0) > 1"
                          :checked="config.valuesOn === 'rows'"
                          @update:checked="
                            config = { ...config, valuesOn: $event ? 'rows' : 'columns' }
                          "
                          >{{ messages.fields.valuesOnRows }}</DouDropdownItem
                        >
                      </template>
                      <DouDropdownItem v-if="canFilter(item)" @click="openFilter(item)">{{
                        messages.fields.filter
                      }}</DouDropdownItem>
                      <DouDropdownSub :title="messages.fields.moveTo" divided>
                        <DouDropdownItem
                          v-for="to in otherAreas(item)"
                          :key="to"
                          @click="moveTo(item, to)"
                          >{{ areaTitle(to) }}</DouDropdownItem
                        >
                      </DouDropdownSub>
                      <DouDropdownItem tone="danger" @click="moveTo(item, null)">{{
                        messages.fields.remove
                      }}</DouDropdownItem>
                    </template>
                  </DouDropdown>
                </div>
              </template>
              <template #empty>
                <p class="dou-pivot-fields__drop">{{ messages.fields.dropHere }}</p>
              </template>
            </DouSortable>
          </section>
        </div>
      </div>
    </component>
  </div>
</template>
