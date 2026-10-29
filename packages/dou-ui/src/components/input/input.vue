<script setup lang="ts">
import { CloseIcon, EyeIcon, EyeOffIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useAttrs, useTemplateRef } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import type { InputExpose, InputProps, InputSlots } from './input'

defineOptions({ name: 'DouInput', inheritAttrs: false })

const props = withDefaults(defineProps<InputProps>(), {
  disabled: false,
  readonly: false,
  invalid: false,
  clearable: false,
  type: 'text',
  showPassword: false,
  showCount: false,
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ clear: [] }>()
const slots = defineSlots<InputSlots>()

const ns = useNamespace('input')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

// `class` and `style` dress the field; every other attribute (placeholder,
// name, autocomplete, listeners...) belongs to the native input. Inside a
// form item the input also takes the item's id and description, unless
// the caller sets them.
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  if (!formItem) return rest
  return {
    id: formItem.inputId,
    'aria-describedby': formItem.describedBy.value,
    'aria-required': formItem.required.value || undefined,
    ...rest,
  }
})

const inputRef = useTemplateRef<HTMLInputElement>('input')

const revealed = ref(false)
const nativeType = computed(() =>
  props.type === 'password' && props.showPassword && revealed.value ? 'text' : props.type,
)

const maxLength = computed(() => {
  const value = Number(attrs.maxlength ?? attrs.maxLength)
  return Number.isFinite(value) && value > 0 ? value : undefined
})
// Count what a person sees as characters, so an emoji counts once.
const count = computed(() => [...model.value].length)

const showClear = computed(
  () => props.clearable && !disabled.value && !props.readonly && model.value !== '',
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', props.readonly),
  ns.is('invalid', invalid.value),
  attrs.class,
])

async function clear() {
  model.value = ''
  emit('clear')
  formItem?.trigger('change', { lazy: true })
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
      :type="nativeType"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid || undefined"
      @input="formItem?.trigger('change', { lazy: true })"
      @blur="formItem?.trigger('blur')"
    />
    <button
      v-if="showClear"
      type="button"
      tabindex="-1"
      :class="ns.e('clear')"
      :aria-label="t('input.clear')"
      @mousedown.prevent
      @click="clear"
    >
      <CloseIcon />
    </button>
    <button
      v-if="type === 'password' && showPassword"
      type="button"
      :class="ns.e('reveal')"
      :aria-label="t(revealed ? 'input.hidePassword' : 'input.showPassword')"
      :aria-pressed="revealed"
      :disabled="disabled"
      @mousedown.prevent
      @click="revealed = !revealed"
    >
      <EyeOffIcon v-if="revealed" />
      <EyeIcon v-else />
    </button>
    <span v-if="showCount" :class="ns.e('count')" aria-hidden="true">
      {{ maxLength ? `${count} / ${maxLength}` : count }}
    </span>
    <span v-if="slots.suffix" :class="[ns.e('affix'), ns.e('suffix')]">
      <slot name="suffix" />
    </span>
  </span>
</template>
