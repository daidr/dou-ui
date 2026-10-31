<script setup lang="ts">
import { computed, nextTick, useId, useTemplateRef } from 'vue'
import { DouAutocomplete } from 'dou-ui'
import type { AutocompleteOption } from 'dou-ui'
import { builtinFunctions, checkExpression } from '../core/expression'
import { formatMessage } from '../locale'
import { completeExpression } from './completion'
import type { Completion } from './completion'
import { useBuilderState } from './context'

/**
 * Expression text with completions of field paths and functions, and the
 * first problem of the expression shown under it as it is typed.
 */
defineOptions({ name: 'DouFormBuilderExpression', inheritAttrs: false })

interface Name {
  path: string
  label?: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    /** The paths `values` can read. */
    names?: Name[]
    /** The paths `item` can read; left out where there is no list item. */
    itemNames?: Name[]
    /** Whether the expression can read `value`, as a check can. */
    readsValue?: boolean
    placeholder?: string
    disabled?: boolean
  }>(),
  { modelValue: '', names: () => [], itemNames: undefined, placeholder: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const state = useBuilderState()
const root = useTemplateRef<HTMLElement>('root')
const errorId = `dou-form-builder-expression-${useId()}`

const text = computed({
  get: () => props.modelValue ?? '',
  set: (value: string) => emit('update:modelValue', value),
})

const functions = computed(() => [
  ...new Set([...Object.keys(builtinFunctions), ...state.functionNames.value]),
])

const problem = computed(() => {
  const source = text.value
  if (!source.trim()) return undefined
  const found = checkExpression(source, {
    fields: props.names.map((name) => name.path),
    itemFields: props.itemNames ? props.itemNames.map((name) => name.path) : [],
    functions: state.functionNames.value,
  })[0]
  if (!found) return undefined
  const words = state.messages.expression.problems
  return formatMessage(words[found.code] ?? found.message, { text: found.text })
})

const input = () => root.value?.querySelector('input') ?? null

/** The completions of the last fetch, by the text each one makes. */
let offered = new Map<string, Completion>()

function fetch(query: string): AutocompleteOption[] {
  const element = input()
  const caret = element?.selectionStart ?? query.length
  const words = state.messages.expression
  const list = completeExpression(
    query,
    caret,
    {
      names: props.names,
      itemNames: props.itemNames,
      value: props.readsValue,
      functions: functions.value,
    },
    { values: words.values, item: words.item, value: words.value },
  )
  offered = new Map(list.map((completion) => [completion.text, completion]))
  return list.map((completion) => ({
    value: completion.text,
    label: completion.label,
    description: completion.description,
  }))
}

async function onSelect(option: AutocompleteOption) {
  const completion = offered.get(option.value)
  await nextTick()
  const element = input()
  if (!completion || !element) return
  element.focus()
  element.setSelectionRange(completion.caret, completion.caret)
}
</script>

<template>
  <div ref="root" class="dou-form-builder__expression">
    <DouAutocomplete
      v-model="text"
      v-bind="$attrs"
      :fetch="fetch"
      :debounce="0"
      :highlight="false"
      :disabled="disabled"
      :invalid="!!problem"
      :placeholder="placeholder"
      :aria-invalid="problem ? 'true' : undefined"
      :aria-describedby="problem ? errorId : undefined"
      spellcheck="false"
      autocomplete="off"
      class="dou-form-builder__expression-input"
      @select="onSelect"
    />
    <div v-if="problem" :id="errorId" class="dou-form-builder__expression-error">
      {{ problem }}
    </div>
  </div>
</template>
