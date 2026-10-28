<script setup lang="ts">
import { computed, nextTick, useAttrs, useTemplateRef } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { InputExpose, InputProps, InputSlots } from './input'

defineOptions({ name: 'DouInput', inheritAttrs: false })

const props = withDefaults(defineProps<InputProps>(), {
  size: 'md',
  disabled: false,
  readonly: false,
  invalid: false,
  clearable: false,
  type: 'text',
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ clear: [] }>()
const slots = defineSlots<InputSlots>()

const ns = useNamespace('input')

// `class` and `style` dress the field; every other attribute (placeholder,
// name, autocomplete, listeners...) belongs to the native input.
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const inputRef = useTemplateRef<HTMLInputElement>('input')

const showClear = computed(
  () => props.clearable && !props.disabled && !props.readonly && model.value !== '',
)

const classes = computed(() => [
  ns.b(),
  ns.m(props.size),
  ns.is('disabled', props.disabled),
  ns.is('readonly', props.readonly),
  ns.is('invalid', props.invalid),
  attrs.class,
])

async function clear() {
  model.value = ''
  emit('clear')
  await nextTick()
  inputRef.value?.focus()
}

// Pressing the padding or a plain affix should land in the text without
// first blurring it. Interactive content inside an affix keeps its own focus.
function onMousedown(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === inputRef.value || target.closest('button, a, input, select, textarea')) return
  event.preventDefault()
  inputRef.value?.focus()
}

defineExpose<InputExpose>({
  get input() {
    return inputRef.value
  },
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
})
</script>

<template>
  <span :class="classes" :style="attrs.style as StyleValue" @mousedown="onMousedown">
    <span v-if="slots.prefix" :class="[ns.e('affix'), ns.e('prefix')]">
      <slot name="prefix" />
    </span>
    <input
      ref="input"
      v-model="model"
      v-bind="inputAttrs"
      :class="ns.e('native')"
      :type="type"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid || undefined"
    />
    <button
      v-if="showClear"
      type="button"
      tabindex="-1"
      :class="ns.e('clear')"
      aria-label="清空"
      @mousedown.prevent
      @click="clear"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5 5l6 6M11 5l-6 6" stroke-linecap="round" />
      </svg>
    </button>
    <span v-if="slots.suffix" :class="[ns.e('affix'), ns.e('suffix')]">
      <slot name="suffix" />
    </span>
  </span>
</template>
