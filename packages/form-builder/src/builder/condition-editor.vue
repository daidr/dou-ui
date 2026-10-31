<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import {
  DouButton,
  DouInput,
  DouInputNumber,
  DouSegmentedControl,
  DouSelect,
  DouTooltip,
} from 'dou-ui'
import type { SelectValue } from 'dou-ui'
import { BracesIcon, CloseIcon, FilterIcon, PlusIcon } from '@dou-ui/icons'
import { parseCondition, printCondition, unaryOperators } from './condition'
import type { Condition, ConditionLiteral, ConditionOperator, ConditionRow } from './condition'
import { useBuilderState } from './context'
import ExpressionInput from './expression-box'
import { operatorsOf } from './logic'
import type { LogicTarget } from './logic'

/**
 * A condition as rows of "field, how, value", written to the node as
 * expression text. An expression the rows cannot say is edited as text.
 */
defineOptions({ name: 'DouFormBuilderCondition' })

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    /** The fields the rows can read. */
    targets?: LogicTarget[]
    disabled?: boolean
  }>(),
  { modelValue: '', targets: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const state = useBuilderState()
const words = computed(() => state.messages.condition)

const condition = shallowRef<Condition>({ join: 'and', rows: [] })
const asText = shallowRef(false)
/** The text this editor wrote last, which needs no reading back. */
let written: string | undefined

watch(
  () => props.modelValue ?? '',
  (source) => {
    if (source === written) return
    written = undefined
    const parsed = parseCondition(source)
    asText.value = !parsed
    if (parsed) condition.value = parsed
  },
  { immediate: true },
)

function commit(next: Condition) {
  condition.value = next
  const text = printCondition(next)
  written = text
  if (text !== (props.modelValue ?? '')) emit('update:modelValue', text)
}

const keyOf = (scope: string, path: string) => `${scope}:${path}`
const option = (target: LogicTarget) => ({
  value: keyOf(target.scope, target.path),
  label: target.label === target.path ? target.path : `${target.label} · ${target.path}`,
})
const targetsByKey = computed(
  () => new Map(props.targets.map((target) => [keyOf(target.scope, target.path), target])),
)
const fieldOptions = computed(() => {
  const own = props.targets.filter((target) => target.scope === 'item')
  const all = props.targets.filter((target) => target.scope === 'values')
  if (!own.length) return all.map(option)
  return [
    { label: words.value.itemGroup, options: own.map(option) },
    { label: words.value.formGroup, options: all.map(option) },
  ]
})

const targetOf = (row: ConditionRow) => targetsByKey.value.get(keyOf(row.scope, row.path))
const operators = (row: ConditionRow): ConditionOperator[] => {
  const target = targetOf(row)
  return target ? operatorsOf[target.kind] : operatorsOf.text
}
function operatorOptions(row: ConditionRow) {
  const date = targetOf(row)?.kind === 'date'
  const labels = words.value.operators
  const dates = words.value.dateOperators
  return operators(row).map((op) => ({
    value: op,
    label: (date ? dates[op] : undefined) ?? labels[op] ?? op,
  }))
}

function setRow(index: number, patch: Partial<ConditionRow>) {
  const rows = condition.value.rows.slice()
  rows[index] = { ...rows[index]!, ...patch }
  commit({ ...condition.value, rows })
}

function pickField(index: number, key: SelectValue | SelectValue[] | null | undefined) {
  const target = targetsByKey.value.get(String(key))
  if (!target) return
  const row = condition.value.rows[index]!
  const ops = operatorsOf[target.kind]
  const op = ops.includes(row.op) ? row.op : ops[0]!
  setRow(index, { scope: target.scope, path: target.path, op, value: initial(target, op) })
}

function initial(target: LogicTarget, op: ConditionOperator) {
  if (unaryOperators.has(op)) return undefined
  if (target.kind === 'boolean') return true
  return op === 'in' ? [] : undefined
}

function pickOperator(index: number, op: ConditionOperator) {
  const row = condition.value.rows[index]!
  const target = targetOf(row)
  const keep = !unaryOperators.has(op) && (op === 'in') === Array.isArray(row.value)
  setRow(index, { op, value: keep ? row.value : target ? initial(target, op) : undefined })
}

function addRow() {
  const first = props.targets[0]
  const row: ConditionRow = first
    ? {
        scope: first.scope,
        path: first.path,
        op: operatorsOf[first.kind][0]!,
        value: initial(first, operatorsOf[first.kind][0]!),
      }
    : { scope: 'values', path: '', op: 'eq' }
  commit({ ...condition.value, rows: [...condition.value.rows, row] })
}

function removeRow(index: number) {
  const rows = condition.value.rows.filter((_, at) => at !== index)
  commit({ ...condition.value, rows })
}

const joinOptions = computed(() => [
  { value: 'and', label: words.value.all },
  { value: 'or', label: words.value.any },
])

/** What a row's value input is. */
function valueInput(row: ConditionRow) {
  if (unaryOperators.has(row.op)) return 'none'
  const target = targetOf(row)
  if (!target) return 'text'
  if (target.kind === 'boolean') return 'boolean'
  if (row.op === 'in' || target.options?.length) return 'select'
  if (target.kind === 'number') return 'number'
  return 'text'
}

const booleanOptions = computed(() => [
  { value: true, label: words.value.yes },
  { value: false, label: words.value.no },
])

function selectOptions(row: ConditionRow) {
  return (targetOf(row)?.options ?? []) as { label: string; value: SelectValue }[]
}

const canUseRows = computed(() => !!parseCondition(props.modelValue ?? ''))
function toRows() {
  const parsed = parseCondition(props.modelValue ?? '')
  if (!parsed) return
  condition.value = parsed
  asText.value = false
}

const names = computed(() =>
  props.targets
    .filter((target) => target.scope === 'values')
    .map((target) => ({ path: target.path, label: target.label })),
)
const itemNames = computed(() => {
  const own = props.targets.filter((target) => target.scope === 'item')
  return own.length ? own.map((target) => ({ path: target.path, label: target.label })) : undefined
})
const textValue = computed({
  get: () => props.modelValue ?? '',
  // Text typed here stays text, even once it could be shown as rows.
  set: (value: string) => {
    written = value
    emit('update:modelValue', value)
  },
})
</script>

<template>
  <div class="dou-form-builder__condition">
    <template v-if="!asText">
      <DouSegmentedControl
        v-if="condition.rows.length > 1"
        :model-value="condition.join"
        :options="joinOptions"
        :disabled="disabled"
        size="sm"
        block
        @update:model-value="commit({ ...condition, join: $event as 'and' | 'or' })"
      />
      <div
        v-for="(row, index) in condition.rows"
        :key="index"
        class="dou-form-builder__condition-row"
        role="group"
        :aria-label="`${words.row} ${index + 1}`"
      >
        <div class="dou-form-builder__condition-line">
          <DouSelect
            :model-value="row.path ? keyOf(row.scope, row.path) : null"
            :options="fieldOptions"
            :placeholder="words.field"
            :aria-label="words.field"
            :disabled="disabled"
            :filterable="targets.length > 8"
            size="sm"
            class="dou-form-builder__condition-field"
            @update:model-value="pickField(index, $event)"
          />
          <DouTooltip :content="words.remove">
            <DouButton
              :aria-label="words.remove"
              :disabled="disabled"
              size="sm"
              variant="ghost"
              @click="removeRow(index)"
            >
              <CloseIcon />
            </DouButton>
          </DouTooltip>
        </div>
        <div class="dou-form-builder__condition-line">
          <DouSelect
            :model-value="row.op"
            :options="operatorOptions(row)"
            :aria-label="words.operator"
            :disabled="disabled"
            size="sm"
            class="dou-form-builder__condition-op"
            @update:model-value="pickOperator(index, $event as ConditionOperator)"
          />
          <template v-if="valueInput(row) !== 'none'">
            <DouSelect
              v-if="valueInput(row) === 'boolean'"
              :model-value="row.value as SelectValue"
              :options="booleanOptions"
              :aria-label="words.value"
              :disabled="disabled"
              size="sm"
              class="dou-form-builder__condition-value"
              @update:model-value="setRow(index, { value: $event as boolean })"
            />
            <DouSelect
              v-else-if="valueInput(row) === 'select'"
              :model-value="row.value as SelectValue | SelectValue[]"
              :options="selectOptions(row)"
              :multiple="row.op === 'in'"
              :creatable="!selectOptions(row).length"
              :filterable="!selectOptions(row).length"
              :placeholder="words.value"
              :aria-label="words.value"
              :disabled="disabled"
              size="sm"
              class="dou-form-builder__condition-value"
              @update:model-value="
                setRow(index, { value: $event as ConditionLiteral | ConditionLiteral[] })
              "
            />
            <DouInputNumber
              v-else-if="valueInput(row) === 'number'"
              :model-value="typeof row.value === 'number' ? row.value : null"
              :controls="false"
              :placeholder="words.value"
              :aria-label="words.value"
              :disabled="disabled"
              size="sm"
              class="dou-form-builder__condition-value"
              @update:model-value="setRow(index, { value: $event ?? undefined })"
            />
            <DouInput
              v-else
              :model-value="typeof row.value === 'string' ? row.value : ''"
              :placeholder="targetOf(row)?.kind === 'date' ? 'YYYY-MM-DD' : words.value"
              :aria-label="words.value"
              :disabled="disabled"
              size="sm"
              class="dou-form-builder__condition-value"
              @update:model-value="setRow(index, { value: $event })"
            />
          </template>
        </div>
      </div>
    </template>
    <ExpressionInput
      v-else
      v-model="textValue"
      :names="names"
      :item-names="itemNames"
      :disabled="disabled"
    />
    <div class="dou-form-builder__condition-footer">
      <DouButton
        v-if="!asText"
        size="sm"
        variant="ghost"
        :disabled="disabled || !targets.length"
        @click="addRow"
      >
        <template #leading><PlusIcon /></template>
        {{ words.add }}
      </DouButton>
      <DouButton
        v-if="!asText"
        size="sm"
        variant="ghost"
        class="dou-form-builder__condition-mode"
        :disabled="disabled"
        @click="asText = true"
      >
        <template #leading><BracesIcon /></template>
        {{ words.toText }}
      </DouButton>
      <!-- Says why rows are out of reach. -->
      <DouTooltip v-else :content="words.notRows" :disabled="canUseRows">
        <DouButton
          size="sm"
          variant="ghost"
          class="dou-form-builder__condition-mode"
          :disabled="disabled || !canUseRows"
          @click="toRows"
        >
          <template #leading><FilterIcon /></template>
          {{ words.toRows }}
        </DouButton>
      </DouTooltip>
    </div>
  </div>
</template>
