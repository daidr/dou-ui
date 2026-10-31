<script setup lang="ts">
import { SearchIcon, SortAscendingIcon, SortDescendingIcon } from '@dou-ui/icons'
import { DouButton, DouCheckbox, DouInput, DouSegmentedControl, DouSelect } from 'dou-ui'
import { computed, ref, shallowRef } from 'vue'
import type { SheetFilterCondition, SheetFilterRule, SheetSortOrder } from '../core/model'
import { format, type SheetMessages } from '../locale'

/*
 * What a filter button opens: sorting by the column, and which of its
 * values (or which condition) the rows must have to stay shown.
 */

const props = defineProps<{
  /** The column's values as they show, each once, in sorted order; `''` is empty. */
  values: readonly string[]
  rule: SheetFilterRule | undefined
  sorted: SheetSortOrder | undefined
  messages: SheetMessages
  readonly: boolean
}>()
const emit = defineEmits<{
  sort: [order: SheetSortOrder]
  apply: [rule: SheetFilterRule | undefined]
}>()

const m = computed(() => props.messages.filter)

/** At most this many values are listed; searching finds the rest. */
const LIMIT = 500

type Mode = 'values' | 'condition'
const mode = ref<Mode>(props.rule && 'condition' in props.rule ? 'condition' : 'values')

// values ------------------------------------------------------------------------------------

const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLocaleLowerCase()
  const all = q
    ? props.values.filter((v) => (v || m.value.blank).toLocaleLowerCase().includes(q))
    : props.values
  return { list: all.slice(0, LIMIT), more: Math.max(0, all.length - LIMIT), all }
})
/** The values kept; all of them when the column has no values rule. */
const kept = shallowRef(
  new Set(props.rule && 'values' in props.rule ? props.rule.values : props.values),
)
const allKept = computed(() => shown.value.all.every((v) => kept.value.has(v)))
const someKept = computed(() => shown.value.all.some((v) => kept.value.has(v)))
function toggle(value: string, on: boolean) {
  const next = new Set(kept.value)
  if (on) next.add(value)
  else next.delete(value)
  kept.value = next
}
function toggleAll(on: boolean) {
  const next = new Set(kept.value)
  for (const v of shown.value.all) {
    if (on) next.add(v)
    else next.delete(v)
  }
  kept.value = next
}

// condition ---------------------------------------------------------------------------------

const OPS: SheetFilterCondition['op'][] = [
  'eq',
  'ne',
  'gt',
  'ge',
  'lt',
  'le',
  'contains',
  'notContains',
  'begins',
  'ends',
  'blank',
  'notBlank',
]
const condition = props.rule && 'condition' in props.rule ? props.rule.condition : undefined
const op = ref<SheetFilterCondition['op']>(condition?.op ?? 'contains')
const operand = ref(condition?.value == null ? '' : String(condition.value))
const needsOperand = computed(() => op.value !== 'blank' && op.value !== 'notBlank')
const opOptions = computed(() => OPS.map((value) => ({ value, label: m.value.ops[value] })))

// result ------------------------------------------------------------------------------------

/** The rule the panel would set; `undefined` keeps every row. */
const result = computed<SheetFilterRule | undefined>(() => {
  if (mode.value === 'condition') {
    if (!needsOperand.value) return { condition: { op: op.value } }
    const text = operand.value.trim()
    if (!text) return undefined
    const n = Number(text)
    return { condition: { op: op.value, value: Number.isFinite(n) && /\d/.test(text) ? n : text } }
  }
  // searched: what is kept among the matches; otherwise everything kept
  const list = search.value.trim() ? shown.value.all : props.values
  const values = list.filter((v) => kept.value.has(v))
  return values.length === props.values.length ? undefined : { values }
})
const empty = computed(
  () =>
    mode.value === 'values' &&
    result.value &&
    'values' in result.value &&
    !result.value.values.length,
)

const label = (value: string) => value || m.value.blank
</script>

<template>
  <div class="dou-sheet-filter">
    <div class="dou-sheet-filter__sort" role="group" :aria-label="m.sort">
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="readonly"
        :aria-pressed="sorted === 'asc'"
        @click="emit('sort', 'asc')"
      >
        <template #leading><SortAscendingIcon /></template>
        {{ m.sortAsc }}
      </DouButton>
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="readonly"
        :aria-pressed="sorted === 'desc'"
        @click="emit('sort', 'desc')"
      >
        <template #leading><SortDescendingIcon /></template>
        {{ m.sortDesc }}
      </DouButton>
    </div>
    <DouSegmentedControl
      v-model="mode"
      size="sm"
      block
      :options="[
        { value: 'values', label: m.byValues },
        { value: 'condition', label: m.byCondition },
      ]"
    />
    <template v-if="mode === 'values'">
      <DouInput v-model="search" size="sm" :placeholder="m.search" :aria-label="m.search" clearable>
        <template #prefix><SearchIcon /></template>
      </DouInput>
      <div class="dou-sheet-filter__list" role="group" :aria-label="m.values">
        <DouCheckbox
          v-if="shown.all.length"
          class="dou-sheet-filter__item is-all"
          :model-value="allKept"
          :indeterminate="someKept && !allKept"
          @update:model-value="(on: boolean) => toggleAll(on)"
        >
          {{ search.trim() ? m.allMatches : m.all }}
        </DouCheckbox>
        <DouCheckbox
          v-for="value in shown.list"
          :key="value"
          class="dou-sheet-filter__item"
          :class="{ 'is-blank': !value }"
          :model-value="kept.has(value)"
          @update:model-value="(on: boolean) => toggle(value, on)"
        >
          {{ label(value) }}
        </DouCheckbox>
        <div v-if="!shown.all.length" class="dou-sheet-filter__hint">{{ m.noMatch }}</div>
        <div v-else-if="shown.more" class="dou-sheet-filter__hint">
          {{ format(m.more, { count: shown.more }) }}
        </div>
      </div>
    </template>
    <div v-else class="dou-sheet-filter__condition">
      <DouSelect v-model="op" size="sm" :options="opOptions" :aria-label="m.condition" />
      <DouInput
        v-if="needsOperand"
        v-model="operand"
        size="sm"
        :placeholder="m.value"
        :aria-label="m.value"
        @keydown.enter="emit('apply', result)"
      />
    </div>
    <div class="dou-sheet-filter__footer">
      <DouButton
        variant="ghost"
        size="sm"
        :disabled="!rule || readonly"
        @click="emit('apply', undefined)"
      >
        {{ m.clear }}
      </DouButton>
      <DouButton
        variant="solid"
        tone="primary"
        size="sm"
        :disabled="!!empty || readonly"
        @click="emit('apply', result)"
      >
        {{ m.apply }}
      </DouButton>
    </div>
  </div>
</template>
