<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useAttrs, useTemplateRef } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { DouTag } from '../tag'
import type { InputTagExpose, InputTagProps, InputTagSlots } from './input-tag'

defineOptions({ name: 'DouInputTag', inheritAttrs: false })

const props = withDefaults(defineProps<InputTagProps>(), {
  disabled: false,
  readonly: false,
  invalid: false,
  clearable: false,
  separators: () => [',', '，'],
  allowDuplicates: false,
  addOnBlur: true,
})
const model = defineModel<string[]>({ default: () => [] })
const emit = defineEmits<{
  add: [tag: string]
  remove: [tag: string, index: number]
  clear: []
}>()
const slots = defineSlots<InputTagSlots>()

const ns = useNamespace('input-tag')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const editable = computed(() => !disabled.value && !props.readonly)

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
const text = ref('')
/** The tag that the next Backspace removes, shown highlighted first. */
const pending = ref(-1)

const full = computed(() => props.max !== undefined && model.value.length >= props.max)

function update(next: string[]) {
  model.value = next
  formItem?.trigger('change')
}

/** Add what can be added from `parts`; returns the parts that were refused. */
function add(parts: string[]) {
  const next = [...model.value]
  const refused: string[] = []
  for (const raw of parts) {
    const tag = raw.trim()
    if (!tag) continue
    const ok =
      (props.max === undefined || next.length < props.max) &&
      (props.allowDuplicates || !next.includes(tag)) &&
      (props.validate?.(tag, next) ?? true)
    if (!ok) {
      refused.push(tag)
      continue
    }
    next.push(tag)
    emit('add', tag)
  }
  if (next.length !== model.value.length) update(next)
  return refused
}

function commit() {
  const refused = add([text.value])
  text.value = refused.join('')
}

function remove(index: number) {
  const tag = model.value[index]
  if (tag === undefined) return
  update(model.value.filter((_, at) => at !== index))
  emit('remove', tag, index)
  pending.value = -1
}

function clear() {
  update([])
  text.value = ''
  emit('clear')
  void nextTick(() => inputRef.value?.focus())
}

const splitter = computed(() => {
  const escaped = props.separators.map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`[${['\\n', '\\r', '\\t', ...escaped].join('')}]`)
})

function onInput() {
  pending.value = -1
  // A typed separator ends the tag before it; anything after carries on.
  if (!splitter.value.test(text.value)) return
  const parts = text.value.split(splitter.value)
  const rest = parts.pop() ?? ''
  const refused = add(parts)
  text.value = [...refused, rest].join('')
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text') ?? ''
  if (!splitter.value.test(pasted)) return
  event.preventDefault()
  const refused = add(`${text.value}${pasted}`.split(splitter.value))
  text.value = refused.join(', ')
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
    return
  }
  if (event.key === 'Backspace' && text.value === '' && model.value.length) {
    event.preventDefault()
    const last = model.value.length - 1
    if (pending.value === last) remove(last)
    else pending.value = last
    return
  }
  if (event.key !== 'Shift') pending.value = -1
}

function onBlur() {
  pending.value = -1
  if (props.addOnBlur && text.value.trim()) commit()
  formItem?.trigger('blur')
}

function onMousedown(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === inputRef.value || target.closest('button')) return
  event.preventDefault()
  inputRef.value?.focus()
}

const showClear = computed(() => props.clearable && editable.value && model.value.length > 0)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', props.readonly),
  ns.is('invalid', invalid.value),
  ns.is('filled', model.value.length > 0),
  attrs.class,
])

defineExpose<InputTagExpose>({
  get input() {
    return inputRef.value
  },
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<template>
  <div :class="classes" :style="attrs.style as StyleValue" @mousedown="onMousedown">
    <span v-if="slots.prefix" :class="ns.e('prefix')"><slot name="prefix" /></span>
    <div :class="ns.e('selection')">
      <DouTag
        v-for="(tag, index) in model"
        :key="`${index}:${tag}`"
        :size="size"
        :closable="editable"
        :close-label="`${t('tag.remove')} ${tag}`"
        :class="[ns.e('tag'), ns.is('pending', pending === index)]"
        @close="remove(index)"
      >
        <slot name="tag" :tag="tag" :index="index">{{ tag }}</slot>
      </DouTag>
      <input
        v-show="!full || text"
        ref="input"
        v-model="text"
        v-bind="inputAttrs"
        :class="ns.e('input')"
        type="text"
        autocomplete="off"
        enterkeyhint="done"
        :placeholder="model.length ? undefined : placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :aria-invalid="invalid || undefined"
        @input="onInput"
        @paste="onPaste"
        @keydown="onKeydown"
        @blur="onBlur"
      />
    </div>
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
  </div>
</template>
