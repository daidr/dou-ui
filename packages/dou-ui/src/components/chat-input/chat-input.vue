<script setup lang="ts">
import { ArrowUpIcon, StopIcon } from '@dou-ui/icons'
import { computed, nextTick, onMounted, ref, useAttrs, useTemplateRef, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled } from '../form/use-form-item'
import type { ChatInputEmits, ChatInputExpose, ChatInputProps, ChatInputSlots } from './chat-input'

defineOptions({ name: 'DouChatInput', inheritAttrs: false })

const props = withDefaults(defineProps<ChatInputProps>(), {
  submitOn: 'enter',
  loading: false,
  disabled: false,
  minRows: 1,
  maxRows: 8,
  canSubmit: undefined,
})
const emit = defineEmits<ChatInputEmits>()
const slots = defineSlots<ChatInputSlots>()
const model = defineModel<string>({ default: '' })

const ns = useNamespace('chat-input')
const { t } = useLocale()
const disabled = useFormDisabled(() => props.disabled)

// `class` and `style` dress the frame, the rest goes to the textarea.
const attrs = useAttrs()
const textareaAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const textareaRef = useTemplateRef<HTMLTextAreaElement>('textarea')

const submittable = computed(
  () => !disabled.value && (props.canSubmit ?? model.value.trim().length > 0),
)

function resize() {
  const el = textareaRef.value
  if (!el) return
  const style = getComputedStyle(el)
  const lineHeight = Number.parseFloat(style.lineHeight) || 22
  const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
  const min = props.minRows * lineHeight + (padding || 0)
  const max = props.maxRows * lineHeight + (padding || 0)
  el.style.height = 'auto'
  const content = el.scrollHeight
  el.style.height = `${Math.min(Math.max(content, min), max)}px`
  el.style.overflowY = content > max ? 'auto' : 'hidden'
}
watch([model, () => props.minRows, () => props.maxRows], () => nextTick(resize))
onMounted(resize)

function submit() {
  if (props.loading || !submittable.value) return
  emit('submit', model.value)
}

function stop() {
  if (props.loading) emit('stop')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return
  const mod = event.ctrlKey || event.metaKey
  const sends = props.submitOn === 'enter' ? !event.shiftKey && !mod : mod
  if (!sends) return
  event.preventDefault()
  submit()
}

const filesOf = (list: DataTransferItemList | undefined) =>
  [...(list ?? [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file)

function onPaste(event: ClipboardEvent) {
  const files = filesOf(event.clipboardData?.items)
  if (!files.length) return
  // keep the file's name from being pasted as text
  event.preventDefault()
  emit('attach', files)
}

const dragging = ref(false)
let depth = 0
const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files')

function onDragenter(event: DragEvent) {
  if (disabled.value || !carriesFiles(event)) return
  depth++
  dragging.value = true
}
function onDragover(event: DragEvent) {
  if (disabled.value || !carriesFiles(event)) return
  event.preventDefault()
}
function onDragleave() {
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}
function onDrop(event: DragEvent) {
  depth = 0
  dragging.value = false
  if (disabled.value) return
  const files = [...(event.dataTransfer?.files ?? [])]
  if (!files.length) return
  event.preventDefault()
  emit('attach', files)
}

// A press anywhere on the frame that is not a control puts the caret in the text.
function onMousedown(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === textareaRef.value || target.closest('button, a, input, select, [tabindex]')) return
  event.preventDefault()
  textareaRef.value?.focus()
}

defineExpose<ChatInputExpose>({
  get textarea() {
    return textareaRef.value
  },
  focus: () => textareaRef.value?.focus(),
  blur: () => textareaRef.value?.blur(),
  submit,
})
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.is('disabled', disabled),
      ns.is('loading', loading),
      ns.is('dragging', dragging),
      attrs.class,
    ]"
    :style="attrs.style as StyleValue"
    @mousedown="onMousedown"
    @dragenter="onDragenter"
    @dragover="onDragover"
    @dragleave="onDragleave"
    @drop="onDrop"
  >
    <div v-if="slots.header" :class="ns.e('header')"><slot name="header" /></div>
    <textarea
      ref="textarea"
      v-model="model"
      :aria-label="placeholder ?? t('chat.placeholder')"
      v-bind="textareaAttrs"
      :class="ns.e('native')"
      :rows="minRows"
      :placeholder="placeholder ?? t('chat.placeholder')"
      :disabled="disabled"
      @keydown="onKeydown"
      @paste="onPaste"
    />
    <div :class="ns.e('footer')">
      <div :class="ns.e('actions')"><slot name="actions" /></div>
      <slot
        name="submit"
        :submit="submit"
        :stop="stop"
        :loading="loading"
        :disabled="loading ? false : !submittable"
      >
        <DouButton
          v-if="loading"
          :class="ns.e('submit')"
          size="sm"
          :aria-label="t('chat.stop')"
          @click="stop"
        >
          <StopIcon />
        </DouButton>
        <DouButton
          v-else
          :class="ns.e('submit')"
          size="sm"
          :disabled="!submittable"
          :aria-label="t('chat.send')"
          @click="submit"
        >
          <ArrowUpIcon />
        </DouButton>
      </slot>
    </div>
  </div>
</template>
