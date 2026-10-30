<script setup lang="ts">
import { isComposing } from '../../utils/keyboard'
import { ArrowUpIcon, StopIcon } from '@dou-ui/icons'
import { computed, nextTick, onMounted, ref, useAttrs, useId, useTemplateRef, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled } from '../form/use-form-item'
import { findToken } from './chat-input'
import type {
  ChatInputEmits,
  ChatInputExpose,
  ChatInputOption,
  ChatInputProps,
  ChatInputSlots,
  ChatInputToken,
} from './chat-input'

defineOptions({ name: 'DouChatInput', inheritAttrs: false })

const props = withDefaults(defineProps<ChatInputProps>(), {
  submitOn: 'enter',
  loading: false,
  disabled: false,
  minRows: 1,
  maxRows: 8,
  canSubmit: undefined,
  commands: () => [],
  mentions: () => [],
})
const emit = defineEmits<ChatInputEmits>()
const slots = defineSlots<ChatInputSlots>()
const model = defineModel<string>({ default: '' })

const ns = useNamespace('chat-input')
const id = useId()
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

// While a reply is generated the button stops it, unless something new
// has been typed: then it sends, and the app may queue the message.
const stopping = computed(() => props.loading && !submittable.value)

function submit() {
  if (!submittable.value) return
  emit('submit', model.value)
}

function stop() {
  if (props.loading) emit('stop')
}

// --- `/` command and `@` mention menu ---
const token = ref<ChatInputToken | null>(null)
const dismissed = ref<number | null>(null)
const active = ref(0)

function readToken() {
  const el = textareaRef.value
  if (!el) return
  const next = findToken(model.value, el.selectionStart ?? model.value.length)
  const current = token.value
  // keyup and click re-read the caret after every key, arrows included: an
  // unchanged token must keep its identity or the menu resets its highlight.
  if (
    next &&
    current &&
    next.trigger === current.trigger &&
    next.start === current.start &&
    next.end === current.end &&
    next.query === current.query
  )
    return
  if (next?.start !== current?.start) dismissed.value = null
  token.value = next
}

const options = computed<ChatInputOption[]>(() => {
  const current = token.value
  if (!current || dismissed.value === current.start) return []
  const source = current.trigger === '/' ? props.commands : props.mentions
  const query = current.query.toLowerCase()
  return source.filter(
    (option) =>
      option.value.toLowerCase().includes(query) ||
      (option.label ?? '').toLowerCase().includes(query),
  )
})
const menuOpen = computed(() => !disabled.value && options.value.length > 0)
// Only a different list moves the highlight back to the first usable option.
const firstEnabled = () =>
  Math.max(
    0,
    options.value.findIndex((option) => !option.disabled),
  )
watch(
  () =>
    menuOpen.value
      ? `${token.value?.trigger}${options.value.map((option) => option.value).join('\u0000')}`
      : '',
  () => (active.value = firstEnabled()),
)

function move(step: 1 | -1) {
  const list = options.value
  for (let offset = 1; offset <= list.length; offset++) {
    const index = (((active.value + step * offset) % list.length) + list.length) % list.length
    if (!list[index]!.disabled) {
      active.value = index
      return
    }
  }
}
const optionId = (index: number) => `${id}-option-${index}`
watch(active, async (index) => {
  await nextTick()
  document.getElementById(optionId(index))?.scrollIntoView?.({ block: 'nearest' })
})

function pick(option: ChatInputOption) {
  const current = token.value
  if (!current || option.disabled) return
  const before = model.value.slice(0, current.start)
  const after = model.value.slice(current.end)
  let caret: number
  if (current.trigger === '/') {
    model.value = before + after.replace(/^\s+/, '')
    caret = before.length
    emit('command', option)
  } else {
    const inserted = `@${option.value} `
    model.value = before + inserted + after.replace(/^\s+/, '')
    caret = before.length + inserted.length
    emit('mention', option)
  }
  token.value = null
  void nextTick(() => {
    textareaRef.value?.focus()
    textareaRef.value?.setSelectionRange(caret, caret)
  })
}

function onMenuKeydown(event: KeyboardEvent): boolean {
  if (!menuOpen.value) return false
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
    return true
  }
  if ((event.key === 'Enter' || event.key === 'Tab') && !isComposing(event)) {
    event.preventDefault()
    pick(options.value[active.value]!)
    return true
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    dismissed.value = token.value?.start ?? null
    return true
  }
  return false
}

function onKeydown(event: KeyboardEvent) {
  if (onMenuKeydown(event)) return
  if (event.key !== 'Enter' || isComposing(event)) return
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
      :aria-autocomplete="commands.length || mentions.length ? 'list' : undefined"
      :aria-expanded="commands.length || mentions.length ? menuOpen : undefined"
      :aria-controls="menuOpen ? `${id}-menu` : undefined"
      :aria-activedescendant="menuOpen ? optionId(active) : undefined"
      @keydown="onKeydown"
      @keyup="readToken"
      @click="readToken"
      @input="readToken"
      @blur="token = null"
      @paste="onPaste"
    />
    <ul v-if="menuOpen" :id="`${id}-menu`" :class="ns.e('menu')" role="listbox" @mousedown.prevent>
      <li
        v-for="(option, index) in options"
        :id="optionId(index)"
        :key="option.value"
        role="option"
        :class="[
          ns.e('option'),
          ns.is('active', index === active),
          ns.is('disabled', !!option.disabled),
        ]"
        :aria-selected="index === active"
        :aria-disabled="option.disabled || undefined"
        @mouseenter="!option.disabled && (active = index)"
        @click="pick(option)"
      >
        <slot name="option" :option="option" :trigger="token!.trigger">
          <component :is="option.icon" v-if="option.icon" :class="ns.e('option-icon')" />
          <span :class="ns.e('option-label')">
            {{ token?.trigger === '/' ? '/' : '@' }}{{ option.label ?? option.value }}
          </span>
          <span v-if="option.description" :class="ns.e('option-description')">
            {{ option.description }}
          </span>
        </slot>
      </li>
    </ul>
    <div :class="ns.e('footer')">
      <div :class="ns.e('actions')"><slot name="actions" /></div>
      <slot
        name="submit"
        :submit="submit"
        :stop="stop"
        :loading="loading"
        :disabled="stopping ? false : !submittable"
      >
        <DouButton
          v-if="stopping"
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
