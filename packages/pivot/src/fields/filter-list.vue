<script setup lang="ts">
import { DouButton, DouCheckbox, DouInput, DouVirtualList, useLocale } from 'dou-ui'
import { SearchIcon } from '@dou-ui/icons'
import { computed, ref, shallowRef } from 'vue'
import type { PivotSource } from '../engine'
import type { PivotGroupBy } from '../engine/group'
import type { PivotFilter } from '../engine/types'
import { labelFormatter } from '../core/format'
import { format, type PivotMessages } from '../locale'

const props = defineProps<{
  source: PivotSource<unknown>
  field: string
  by?: PivotGroupBy
  filter?: PivotFilter
  messages: PivotMessages
}>()
const emit = defineEmits<{ apply: [filter: PivotFilter | null]; cancel: [] }>()

const ROW = 32
const { locale } = useLocale()

/** Each group of the field, in its natural order, with how many records it has. */
const groups = computed(() => {
  const column = props.source.dimension(props.field, props.by)
  const m = props.messages
  const write = labelFormatter(
    props.source.field(props.field),
    locale.value.name,
    {
      empty: m.empty,
      yes: m.yes,
      no: m.no,
      year: m.yearLabel,
      quarter: m.quarterLabel,
      week: m.weekLabel,
      range: m.rangeLabel,
    },
    props.by,
  )
  const counts = new Uint32Array(column.labels.length)
  for (let i = 0; i < column.codes.length; i++) counts[column.codes[i]!]!++
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const order = Array.from(column.labels.keys()).sort((a, b) => column.rank[a]! - column.rank[b]!)
  return order.map((code) => ({
    code,
    value: column.labels[code],
    text: write(column.labels[code]),
    count: counts[code]!,
  }))
})

/** Picked groups, by group number; starts from the filter as it is. */
const picked = shallowRef(initial())
function initial() {
  const column = props.source.dimension(props.field, props.by)
  const keep = new Uint8Array(column.labels.length)
  const f = props.filter
  if (f?.include) for (const v of f.include) mark(keep, column.find(v), 1)
  else {
    keep.fill(1)
    for (const v of f?.exclude ?? []) mark(keep, column.find(v), 0)
  }
  return keep
}
function mark(keep: Uint8Array, code: number, to: 0 | 1) {
  if (code >= 0) keep[code] = to
}

const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  return q ? groups.value.filter((g) => g.text.toLocaleLowerCase().includes(q)) : groups.value
})

const pickedCount = computed(() => picked.value.reduce((n, v) => n + v, 0))
const shownPicked = computed(() => shown.value.filter((g) => picked.value[g.code]).length)
const allShown = computed(() => shown.value.length > 0 && shownPicked.value === shown.value.length)

function toggle(code: number, on: boolean) {
  const next = picked.value.slice()
  next[code] = on ? 1 : 0
  picked.value = next
}
function toggleShown(on: boolean) {
  const next = picked.value.slice()
  for (const g of shown.value) next[g.code] = on ? 1 : 0
  picked.value = next
}

function apply() {
  const total = groups.value.length
  const count = pickedCount.value
  if (count === total) return emit('apply', null)
  const keep = picked.value
  const values = (on: number) => groups.value.filter((g) => keep[g.code] === on).map((g) => g.value)
  // the shorter list; leaving some out keeps groups that show up later
  const filter: PivotFilter =
    total - count <= count ? { exclude: values(0) } : { include: values(1) }
  if (props.by !== undefined) filter.by = props.by
  emit('apply', filter)
}

const fieldLabel = computed(() => props.source.field(props.field).label)
</script>

<template>
  <div
    class="dou-pivot-filter"
    role="group"
    :aria-label="format(messages.filter.title, { field: fieldLabel })"
  >
    <DouInput
      v-model="query"
      class="dou-pivot-filter__search"
      size="sm"
      type="search"
      clearable
      :placeholder="messages.filter.search"
      :aria-label="messages.filter.search"
    >
      <template #prefix><SearchIcon aria-hidden="true" /></template>
    </DouInput>
    <div class="dou-pivot-filter__all">
      <DouCheckbox
        :model-value="allShown"
        :indeterminate="shownPicked > 0 && !allShown"
        :disabled="!shown.length"
        size="sm"
        @update:model-value="toggleShown(!!$event)"
      >
        {{ messages.filter.all }}
      </DouCheckbox>
    </div>
    <DouVirtualList
      v-if="shown.length"
      class="dou-pivot-filter__list"
      :items="shown"
      :item-size="ROW"
      item-key="code"
      :height="Math.min(shown.length * ROW, ROW * 8)"
    >
      <template #default="{ item }">
        <div class="dou-pivot-filter__item">
          <DouCheckbox
            :model-value="!!picked[item.code]"
            size="sm"
            @update:model-value="toggle(item.code, !!$event)"
          >
            <span class="dou-pivot-filter__text">{{ item.text }}</span>
          </DouCheckbox>
          <span class="dou-pivot-filter__count">{{ item.count.toLocaleString(locale.name) }}</span>
        </div>
      </template>
    </DouVirtualList>
    <p v-else class="dou-pivot-filter__none">{{ messages.filter.noMatch }}</p>
    <div class="dou-pivot-filter__foot">
      <span class="dou-pivot-filter__picked">{{
        format(messages.filter.count, { picked: pickedCount, total: groups.length })
      }}</span>
      <DouButton size="sm" variant="ghost" @click="emit('cancel')">{{
        messages.filter.cancel
      }}</DouButton>
      <DouButton size="sm" tone="primary" :disabled="pickedCount === 0" @click="apply">{{
        messages.filter.apply
      }}</DouButton>
    </div>
  </div>
</template>
