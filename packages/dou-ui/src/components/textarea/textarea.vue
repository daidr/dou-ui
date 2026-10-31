<script setup lang="ts">
import { computed, nextTick, onMounted, useAttrs, useTemplateRef, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import type { TextareaExpose, TextareaProps } from './textarea'
import { fit, fitLater, sizedByStyle } from './autosize'

defineOptions({ name: 'DouTextarea', inheritAttrs: false })

const props = withDefaults(defineProps<TextareaProps>(), {
  rows: 3,
  autosize: false,
  resize: 'vertical',
  disabled: false,
  readonly: false,
  invalid: false,
  showCount: false,
})
const model = defineModel<string>({ default: '' })

const ns = useNamespace('textarea')
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

// As with the input: `class` and `style` dress the field, the rest goes
// to the native element.
const attrs = useAttrs()
const textareaAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  if (!formItem) return rest
  return {
    id: formItem.inputId,
    'aria-describedby': formItem.describedBy.value,
    'aria-required': formItem.required.value || undefined,
    ...rest,
  }
})

const textareaRef = useTemplateRef<HTMLTextAreaElement>('textarea')

const maxLength = computed(() => {
  const value = Number(attrs.maxlength ?? attrs.maxLength)
  return Number.isFinite(value) && value > 0 ? value : undefined
})
// Count what a person sees as characters, so an emoji counts once.
const count = computed(() => [...model.value].length)

const autosize = computed(() => {
  if (!props.autosize) return null
  const options = props.autosize === true ? {} : props.autosize
  return { minRows: options.minRows ?? props.rows, maxRows: options.maxRows }
})

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('autosize', !!autosize.value),
  attrs.class,
])

const nativeStyle = computed((): StyleValue => {
  const range = autosize.value
  if (!range) return { resize: props.resize }
  return {
    resize: 'none' as const,
    '--dou-textarea-min-rows': range.minRows,
    '--dou-textarea-max-rows': range.maxRows,
  }
})

function measure() {
  const el = textareaRef.value
  const range = autosize.value
  if (!el || !range || !el.isConnected) return null
  const style = getComputedStyle(el)
  const lineHeight = Number.parseFloat(style.lineHeight) || 20
  const padding =
    (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)
  const min = range.minRows * lineHeight + padding
  const max = range.maxRows ? range.maxRows * lineHeight + padding : Infinity
  return { el, min, max }
}

function resizeToContent() {
  const field = measure()
  if (field) fit([field])
}

// Where the browser sizes fields to their content, the styles do it all.
// Elsewhere the fields that open together, as in a panel of them, are
// fitted together, reading the layout once instead of once per field.
const schedule = () => {
  if (!sizedByStyle()) fitLater(measure)
}
watch([model, () => autosize.value?.minRows, () => autosize.value?.maxRows], () =>
  nextTick(schedule),
)
onMounted(schedule)

function onMousedown(event: MouseEvent) {
  if (event.target === textareaRef.value) return
  event.preventDefault()
  textareaRef.value?.focus()
}

defineExpose<TextareaExpose>({
  get textarea() {
    return textareaRef.value
  },
  focus: () => textareaRef.value?.focus(),
  blur: () => textareaRef.value?.blur(),
  select: () => textareaRef.value?.select(),
  resizeToContent,
})
</script>

<template>
  <span :class="classes" :style="attrs.style as StyleValue" @mousedown="onMousedown">
    <textarea
      ref="textarea"
      v-model="model"
      v-bind="textareaAttrs"
      :class="ns.e('native')"
      :style="nativeStyle"
      :rows="autosize ? autosize.minRows : rows"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid || undefined"
      @input="formItem?.trigger('change', { lazy: true })"
      @blur="formItem?.trigger('blur')"
    />
    <span v-if="showCount" :class="ns.e('count')">
      {{ maxLength ? `${count} / ${maxLength}` : count }}
    </span>
  </span>
</template>
