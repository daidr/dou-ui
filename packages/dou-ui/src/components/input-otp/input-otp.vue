<script setup lang="ts">
import { computed, ref, useAttrs, useTemplateRef } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import type { InputOtpExpose, InputOtpProps, InputOtpSlots } from './input-otp'

defineOptions({ name: 'DouInputOtp', inheritAttrs: false })

const props = withDefaults(defineProps<InputOtpProps>(), {
  length: 6,
  type: 'numeric',
  mask: false,
  disabled: false,
  invalid: false,
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ complete: [value: string] }>()
const slots = defineSlots<InputOtpSlots>()

const ns = useNamespace('input-otp')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

// The code lives in one native input laid over the cells, so autofill,
// paste, undo and screen readers all see a single ordinary text field.
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  const labelled = rest['aria-label'] || rest['aria-labelledby'] || formItem?.labelId
  const base = {
    'aria-label': labelled ? undefined : t('inputOtp.label'),
  }
  if (!formItem) return { ...base, ...rest }
  return {
    ...base,
    id: formItem.inputId,
    'aria-describedby': formItem.describedBy.value,
    'aria-required': formItem.required.value || undefined,
    ...rest,
  }
})

const inputRef = useTemplateRef<HTMLInputElement>('input')
const focused = ref(false)

const accepts = computed(() => {
  if (props.type === 'numeric') return /\d/
  if (props.type === 'alphanumeric') return /[\da-z]/i
  return /\S/
})

const clean = (value: string) =>
  [...value]
    .filter((char) => accepts.value.test(char))
    .join('')
    .slice(0, props.length)

const value = computed(() => clean(model.value))
const chars = computed(() => Array.from({ length: props.length }, (_, at) => value.value[at] ?? ''))

/** The cell the next character goes into; the last one once all are filled. */
const active = computed(() => (focused.value ? Math.min(value.value.length, props.length - 1) : -1))

const gaps = computed(() => {
  const { separator } = props
  return new Set(separator === undefined ? [] : Array.isArray(separator) ? separator : [separator])
})

// The caret always sits at the end, so a new character always fills the next cell.
function toEnd() {
  const input = inputRef.value
  if (!input) return
  const end = input.value.length
  if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end)
}

// Moving the caret inside the code would make typing fill the wrong cell.
const caretKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])
function onKeydown(event: KeyboardEvent) {
  if (caretKeys.has(event.key) && !event.shiftKey) event.preventDefault()
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const next = clean(input.value)
  if (input.value !== next) input.value = next
  const changed = next !== value.value
  model.value = next
  if (changed) formItem?.trigger('change', { lazy: next.length < props.length })
  if (changed && next.length === props.length) emit('complete', next)
}

function onFocus() {
  focused.value = true
  requestAnimationFrame(toEnd)
}

function onBlur() {
  focused.value = false
  formItem?.trigger('blur')
}

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('focused', focused.value),
  attrs.class,
])

defineExpose<InputOtpExpose>({
  get input() {
    return inputRef.value
  },
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<template>
  <div :class="classes" :style="attrs.style as StyleValue">
    <div :class="ns.e('cells')" aria-hidden="true">
      <template v-for="(char, index) in chars" :key="index">
        <span
          :class="[ns.e('cell'), ns.is('filled', char !== ''), ns.is('active', active === index)]"
        >
          <span v-if="char && mask" :class="ns.e('dot')" />
          <template v-else>{{ char }}</template>
          <span v-if="active === index && !char" :class="ns.e('caret')" />
        </span>
        <span v-if="gaps.has(index + 1) && index + 1 < length" :class="ns.e('separator')">
          <slot name="separator" :after="index + 1" />
        </span>
      </template>
    </div>
    <input
      ref="input"
      v-bind="inputAttrs"
      :value="value"
      :class="ns.e('native')"
      :type="mask ? 'password' : 'text'"
      :inputmode="type === 'numeric' ? 'numeric' : 'text'"
      :pattern="type === 'numeric' ? '\\d*' : undefined"
      :maxlength="length"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid || undefined"
      autocomplete="one-time-code"
      autocapitalize="off"
      spellcheck="false"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @click="toEnd"
      @keydown="onKeydown"
    />
  </div>
</template>
