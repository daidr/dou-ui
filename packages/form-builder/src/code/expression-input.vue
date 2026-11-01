<script setup lang="ts">
import { DouCodeInput } from '@dou-ui/code'
import { computed, useId } from 'vue'
import { builtinFunctions, checkExpression } from '../core/expression'
import { formatMessage } from '../locale'
import { useBuilderState } from '../builder/context'
import { expressionCodeExtension } from './extension'
import type { ExpressionName } from './extension'
import { formExpression } from './language'

/**
 * The builder's expression box as a code input: colored, with completions
 * of field paths and functions, parameter hints, and problems underlined
 * as well as written under it.
 */
defineOptions({ name: 'DouFormBuilderCodeExpression', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    names?: ExpressionName[]
    itemNames?: ExpressionName[]
    readsValue?: boolean
    placeholder?: string
    disabled?: boolean
    /** Shown and selectable, but not changed; also when the form around is read-only. */
    readonly?: boolean
  }>(),
  { modelValue: '', names: () => [], itemNames: undefined, placeholder: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const state = useBuilderState()
const errorId = `dou-form-builder-expression-${useId()}`
const words = computed(() => state.messages.expression)

const problemMessage = (problem: { code: string; message: string; text: string }) =>
  formatMessage(words.value.problems[problem.code] ?? problem.message, { text: problem.text })

const extensions = [
  expressionCodeExtension({
    names: () => props.names,
    itemNames: () => props.itemNames,
    readsValue: () => !!props.readsValue,
    functions: () => state.functionNames.value,
    functionInfo: () => words.value.functions,
    labels: () => words.value,
    problemMessage,
  }),
]

const text = computed(() => props.modelValue ?? '')

// The first problem in words too, for screen readers and at a glance.
const problem = computed(() => {
  if (!text.value.trim()) return undefined
  const found = checkExpression(text.value, {
    fields: props.names.map((name) => name.path),
    itemFields: props.itemNames ? props.itemNames.map((name) => name.path) : [],
    functions: [...new Set([...Object.keys(builtinFunctions), ...state.functionNames.value])],
  })[0]
  return found && problemMessage(found)
})
</script>

<template>
  <div class="dou-form-builder__expression">
    <DouCodeInput
      v-bind="$attrs"
      :model-value="text"
      :language="formExpression"
      :extensions="extensions"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :invalid="!!problem"
      :aria-describedby="problem ? errorId : undefined"
      multiline
      :autosize="{ maxRows: 4 }"
      size="sm"
      class="dou-form-builder__expression-input"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <div v-if="problem" :id="errorId" class="dou-form-builder__expression-error">
      {{ problem }}
    </div>
  </div>
</template>
