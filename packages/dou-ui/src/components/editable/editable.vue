<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, useId, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled } from '../form/use-form-item'
import type { EditableEmits, EditableExpose, EditableProps, EditableSlots } from './editable'

defineOptions({ name: 'DouEditable', inheritAttrs: false })

const props = withDefaults(defineProps<EditableProps>(), {
  modelValue: '',
  placeholder: undefined,
  multiline: false,
  trigger: 'click',
  blurAction: 'submit',
  validate: undefined,
  selectOnEdit: true,
  maxlength: undefined,
  disabled: false,
  ariaLabel: undefined,
})
const value = defineModel<string>({ default: '' })
const editing = defineModel<boolean>('editing', { default: false })
const emit = defineEmits<EditableEmits>()
defineSlots<EditableSlots>()

const ns = useNamespace('editable')
const { t } = useLocale()
const id = `dou-editable-${useId()}`
const disabled = useFormDisabled(() => props.disabled)

// `class`, `style` and listeners stay on the wrapper; other attributes
// (name, inputmode, autocomplete...) belong to the field.
const attrs = useAttrs()
const rootAttrs = computed(() => {
  const out: Record<string, unknown> = {}
  for (const key in attrs)
    if (key === 'class' || key === 'style' || /^on[A-Z]/.test(key)) out[key] = attrs[key]
  return out
})
const fieldAttrs = computed(() => {
  const out: Record<string, unknown> = {}
  for (const key in attrs) if (!(key in rootAttrs.value)) out[key] = attrs[key]
  return out
})

const draft = ref('')
const error = ref<string | null>(null)
const checking = ref(false)
const field = useTemplateRef<HTMLInputElement | HTMLTextAreaElement>('field')
const view = useTemplateRef<HTMLElement>('view')

function fit() {
  const el = field.value
  if (!props.multiline || !el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
}

watch(
  editing,
  async (open, was) => {
    if (open && !was) {
      draft.value = value.value
      error.value = null
      await nextTick()
      fit()
      field.value?.focus()
      if (props.selectOnEdit) field.value?.select()
    }
  },
  { immediate: true },
)

function edit() {
  if (disabled.value) return
  editing.value = true
}

// Focus goes back to the text only when the edit ended from the keyboard.
async function close(refocus: boolean) {
  editing.value = false
  error.value = null
  if (!refocus) return
  await nextTick()
  view.value?.focus()
}

async function submit(refocus = false) {
  if (!editing.value || checking.value) return
  const next = draft.value
  if (props.validate) {
    checking.value = true
    try {
      const result = await props.validate(next)
      if (result === false || typeof result === 'string') {
        error.value = typeof result === 'string' ? result : ''
        field.value?.focus()
        return
      }
    } finally {
      checking.value = false
    }
  }
  if (next !== value.value) value.value = next
  emit('submit', next)
  await close(refocus)
}

async function cancel(refocus = false) {
  if (!editing.value) return
  emit('cancel')
  await close(refocus)
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Escape') {
    event.preventDefault()
    // Escape here ends the edit, not a dialog around it.
    event.stopPropagation()
    void cancel(true)
  } else if (event.key === 'Enter') {
    if (props.multiline && !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    void submit(true)
  }
}

function onBlur() {
  if (!editing.value || checking.value) return
  if (props.blurAction === 'cancel') void cancel()
  else void submit()
}

function onInput() {
  if (error.value !== null) error.value = null
  fit()
}

function onViewKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === 'F2') {
    event.preventDefault()
    edit()
  }
}

const empty = computed(() => !value.value)
// The view is named by its text; a label goes in front of it.
const viewLabel = computed(() =>
  props.ariaLabel ? `${props.ariaLabel}, ${value.value || props.placeholder || ''}` : undefined,
)
const invalid = computed(() => error.value !== null)

defineExpose<EditableExpose>({ edit, submit: () => submit(), cancel: () => cancel() })
</script>

<template>
  <div
    v-bind="rootAttrs"
    :class="[
      ns.b(),
      ns.is('editing', editing),
      ns.is('multiline', multiline),
      ns.is('disabled', disabled),
      ns.is('invalid', invalid),
    ]"
  >
    <template v-if="editing">
      <textarea
        v-if="multiline"
        :id="id"
        ref="field"
        v-model="draft"
        :class="ns.e('field')"
        rows="1"
        v-bind="fieldAttrs"
        :aria-label="ariaLabel"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :aria-invalid="invalid || undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        @keydown="onKeydown"
        @blur="onBlur"
        @input="onInput"
      />
      <input
        v-else
        :id="id"
        ref="field"
        v-model="draft"
        type="text"
        :class="ns.e('field')"
        v-bind="fieldAttrs"
        :aria-label="ariaLabel"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :aria-invalid="invalid || undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        @keydown="onKeydown"
        @blur="onBlur"
        @input="onInput"
      />
      <div v-if="error" :id="`${id}-error`" :class="ns.e('error')" role="alert">{{ error }}</div>
    </template>
    <span
      v-else
      ref="view"
      :class="[ns.e('view'), ns.is('empty', empty), ns.is('blank', empty && !placeholder)]"
      role="button"
      :tabindex="disabled ? undefined : 0"
      :aria-label="viewLabel"
      :aria-disabled="disabled || undefined"
      :aria-description="disabled ? undefined : t('editable.hint')"
      @click="trigger === 'click' && edit()"
      @dblclick="trigger === 'dblclick' && edit()"
      @keydown="onViewKeydown"
    >
      <slot :value="value" :edit="edit">{{ empty ? placeholder : value }}</slot>
    </span>
  </div>
</template>
