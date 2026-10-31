<script setup lang="ts">
import { computed, ref, useAttrs, watchEffect } from 'vue'
import type { StyleValue } from 'vue'
import { useFormDisabled, useFormItem, useFormSize, useGlobalConfig, useNamespace } from 'dou-ui'
import CodeEditor from './code-editor.vue'
import type { CodeKeymap } from './core/keymap'
import type { CodeTransactionResult } from './core/transaction'
import type { CodeEditorExpose, CodeInputEmits, CodeInputProps } from './types'

/**
 * A code box the size of a text input, for expressions and formulas: one
 * line (or a few, with `multiline`), highlighted, with the editor's
 * completions and problems. Inside a form item it takes the item's id,
 * description and state, as DouInput does.
 */
defineOptions({ name: 'DouCodeInput', inheritAttrs: false })

const props = withDefaults(defineProps<CodeInputProps>(), {
  modelValue: '',
  multiline: false,
  autosize: () => ({}),
  invalid: false,
  disabled: undefined,
  readonly: false,
  language: undefined,
  closeBrackets: true,
  teleport: undefined,
  keys: false,
  messages: undefined,
})
const emit = defineEmits<CodeInputEmits>()

const ns = useNamespace('code-input')
const attrs = useAttrs()
const config = useGlobalConfig()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

const editor = ref<CodeEditorExpose>()
const root = ref<HTMLElement>()

// Boxes about the text go above the page: a box this small can't hold them.
// `false` keeps them inside, where an overflow-hidden box may cut them off.
const teleport = computed(() =>
  props.teleport === false ? false : (props.teleport ?? (config.value.teleport || 'body')),
)

function submit() {
  emit('enter')
  return true
}

const keymap = computed<CodeKeymap>(() => {
  // One line: Enter hands over to the form. Several: Mod + Enter does.
  const own: CodeKeymap = props.multiline
    ? { 'mod+enter': submit }
    : { enter: submit, 'shift+enter': submit, 'mod+enter': submit }
  return { ...own, ...props.keymap }
})

/** One line only: line breaks typed, pasted or dropped become spaces. */
const flatten = (text: string) => text.replace(/[ \t]*\r?\n[ \t]*/g, ' ')

function onPaste(event: ClipboardEvent) {
  if (props.multiline || !editor.value) return
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!/[\r\n]/.test(text)) return
  event.preventDefault()
  event.stopPropagation()
  editor.value.transact((tr) => tr.replaceSelection(flatten(text)), {
    action: 'paste',
    scroll: true,
  })
}

// A phone's Enter key may come as input with no key event before it.
function onBeforeInput(event: InputEvent) {
  if (props.multiline) return
  if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return
  event.preventDefault()
  event.stopPropagation()
  emit('enter')
}

function onTransaction(result: CodeTransactionResult) {
  emit('transaction', result)
  // Whatever else brought a line break in (a drop, an extension): one line again.
  if (props.multiline || result.meta.action === 'external' || result.state.doc.lines < 2) return
  const text = result.state.doc.toString()
  editor.value?.transact((tr) => tr.replace(0, text.length, flatten(text)), { history: false })
}

// The textarea is the control a label and a form item point at.
watchEffect(() => {
  const textarea = root.value?.querySelector('textarea')
  if (!textarea) return
  const set = (name: string, value: string | undefined) =>
    value === undefined ? textarea.removeAttribute(name) : textarea.setAttribute(name, value)
  set('id', (attrs.id as string | undefined) ?? formItem?.inputId)
  set(
    'aria-describedby',
    (attrs['aria-describedby'] as string | undefined) ?? formItem?.describedBy.value,
  )
  set('aria-required', formItem?.required.value ? 'true' : undefined)
  set('aria-invalid', invalid.value ? 'true' : undefined)
  set('enterkeyhint', props.multiline ? 'enter' : 'done')
})

const height = computed(() => {
  if (!props.multiline) return undefined
  const min = Math.max(1, props.autosize.minRows ?? 1)
  const max = Math.max(min, props.autosize.maxRows ?? 6)
  return { '--dou-code-input-min-rows': min, '--dou-code-input-max-rows': max }
})

// The same instance as the editor's.
const EXPOSED = [
  'state',
  'doc',
  'selection',
  'transact',
  'run',
  'undo',
  'redo',
  'canUndo',
  'canRedo',
  'select',
  'scrollIntoView',
  'coordsAtPos',
  'posAtCoords',
  'focus',
  'blur',
  'openSearch',
  'closeSearch',
  'fold',
  'unfold',
  'foldAll',
  'unfoldAll',
  'folds',
  'diagnostics',
] as const
const exposed = {} as CodeEditorExpose
for (const key of EXPOSED)
  Object.defineProperty(exposed, key, {
    enumerable: true,
    get: () => editor.value?.[key],
  })
defineExpose(exposed)
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.m(size),
      ns.is('multiline', multiline),
      ns.is('invalid', invalid),
      ns.is('disabled', disabled),
      attrs.class,
    ]"
    :style="[attrs.style as StyleValue, height]"
    @paste.capture="onPaste"
    @beforeinput.capture="onBeforeInput"
  >
    <CodeEditor
      ref="editor"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :language="language"
      :extensions="extensions"
      :diagnostics="diagnostics"
      :close-brackets="closeBrackets"
      :tab-size="tabSize"
      :messages="messages"
      :keys="keys"
      :keymap="keymap"
      :teleport="teleport"
      :aria-label="ariaLabel"
      :autofocus="autofocus"
      :gutter="false"
      :active-line="false"
      :foldable="false"
      :searchable="false"
      :tab-indents="false"
      :wrap="multiline"
      @update:model-value="
        (value: string) => {
          emit('update:modelValue', value)
          formItem?.trigger('change', { lazy: true })
        }
      "
      @transaction="onTransaction"
      @focus="emit('focus', $event)"
      @blur="
        (event: FocusEvent) => {
          emit('blur', event)
          formItem?.trigger('blur')
        }
      "
    />
  </div>
</template>
