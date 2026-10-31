<script setup lang="ts">
import { DouButton, DouDialog, DouForm, DouFormItem, DouInput, DouTextarea } from 'dou-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { checkFormula, PivotFormulaError, type PivotSource } from '../engine'
import type { PivotMessages } from '../locale'
import { format } from '../locale'

const props = defineProps<{
  source: PivotSource<unknown>
  messages: PivotMessages
  /** The value being changed, or null for a new one. */
  initial: { formula: string; label?: string } | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [value: { formula: string; label?: string }] }>()

const name = ref('')
const text = ref('')
/** Errors show once the formula has been edited, or on applying. */
const touched = ref(false)
const box = ref<InstanceType<typeof DouTextarea> | null>(null)

watch(open, (now) => {
  if (!now) return
  name.value = props.initial?.label ?? ''
  text.value = props.initial?.formula ?? ''
  touched.value = false
})

const error = computed(() => {
  try {
    checkFormula(props.source, text.value)
    return ''
  } catch (e) {
    if (!(e instanceof PivotFormulaError)) return String(e)
    return format(props.messages.formula.errors[e.code], { detail: e.detail })
  }
})

/** Number fields, to put in the formula by name. */
const numbers = computed(() => [...props.source.fields.values()].filter((f) => f.type === 'number'))
const SIMPLE = /^[\p{L}_$][\p{L}\p{N}_$.]*$/u
const reference = (label: string, fieldName: string) => {
  // the label reads better; a name in brackets when the label is not one word or is taken
  const labels = [...props.source.fields.values()].filter((f) => f.label === label)
  const word = labels.length === 1 ? label : fieldName
  return SIMPLE.test(word) ? word : `[${word}]`
}

function insert(word: string) {
  const el = box.value?.textarea
  const at = el ? el.selectionStart : text.value.length
  const end = el ? el.selectionEnd : at
  const before = text.value.slice(0, at)
  const pad = before && !/[\s(]$/.test(before) ? ' ' : ''
  text.value = `${before}${pad}${word}${text.value.slice(end)}`
  touched.value = true
  nextTick(() => {
    const caret = at + pad.length + word.length
    el?.focus()
    el?.setSelectionRange(caret, caret)
  })
}

function apply() {
  touched.value = true
  if (error.value) return
  const label = name.value.trim()
  emit('apply', { formula: text.value.trim(), ...(label ? { label } : {}) })
  open.value = false
}
</script>

<template>
  <DouDialog v-model:open="open" :title="messages.formula.title" :width="440">
    <DouForm layout="vertical" class="dou-pivot-formula" @submit="apply">
      <DouFormItem :label="messages.formula.name">
        <DouInput v-model="name" :placeholder="messages.formula.namePlaceholder" />
      </DouFormItem>
      <DouFormItem
        :label="messages.formula.formula"
        :error="touched ? error : undefined"
        :help="messages.formula.help"
      >
        <DouTextarea
          ref="box"
          v-model="text"
          class="dou-pivot-formula__box"
          :rows="2"
          autosize
          :invalid="touched && !!error"
          :placeholder="messages.formula.placeholder"
          @update:model-value="touched = true"
          @keydown.enter.exact.prevent="apply"
        />
      </DouFormItem>
      <div v-if="numbers.length" class="dou-pivot-formula__fields">
        <span class="dou-pivot-formula__fields-title">{{ messages.formula.fields }}</span>
        <DouButton
          v-for="f in numbers"
          :key="f.name"
          size="sm"
          variant="outline"
          @click="insert(reference(f.label, f.name))"
          >{{ f.label }}</DouButton
        >
      </div>
    </DouForm>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">{{ messages.formula.cancel }}</DouButton>
      <DouButton variant="solid" :disabled="touched && !!error" @click="apply">{{
        messages.formula.apply
      }}</DouButton>
    </template>
  </DouDialog>
</template>
