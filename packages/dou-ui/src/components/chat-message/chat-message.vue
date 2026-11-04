<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, EditIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { isComposing } from '../../utils/keyboard'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { DouChatArtifact } from '../chat-artifact'
import { DouChatAttachments } from '../chat-attachments'
import { DouChatConfirm } from '../chat-confirm'
import { DouChatPlan } from '../chat-plan'
import { DouChatReasoning } from '../chat-reasoning'
import { DouChatSources } from '../chat-sources'
import { DouChatSteps } from '../chat-steps'
import { DouChatToolCall } from '../chat-tool-call'
import { useLocale } from '../config-provider/use-config'
import { DouCopyButton } from '../copy-button'
import { DouMarkdown } from '../markdown'
import type { ChatSource } from '../chat-sources/chat-sources'
import { DouStreamText } from '../stream-text'
import { DouTooltip } from '../tooltip'
import { messageText } from './chat-message'
import type {
  ChatArtifactPart,
  ChatConfirmPart,
  ChatCustomPart,
  ChatMessageEmits,
  ChatMessagePart,
  ChatMessageMarkdownSlots,
  ChatMessageProps,
  ChatMessageSlots,
} from './chat-message'

defineOptions({ name: 'DouChatMessage' })

const props = withDefaults(defineProps<ChatMessageProps>(), {
  sender: 'assistant',
  loading: false,
  copyable: true,
  editable: false,
  markdown: false,
  versions: 1,
  version: undefined,
})
const emit = defineEmits<ChatMessageEmits>()
const slots = defineSlots<ChatMessageSlots & ChatMessageMarkdownSlots>()

const ns = useNamespace('chat-message')
const { t } = useLocale()

type AnyPart = ChatMessagePart | ChatCustomPart

const parts = computed<AnyPart[]>(
  () => props.parts ?? (props.content === undefined ? [] : [{ type: 'text', text: props.content }]),
)
const markdownOptions = computed(() =>
  typeof props.markdown === 'object' ? props.markdown : undefined,
)
// `markdown-code` here is the Markdown component's `code`
const PREFIX = 'markdown-'
const markdownSlots = () =>
  Object.keys(slots)
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => ({
      name: name as keyof ChatMessageMarkdownSlots,
      inner: name.slice(PREFIX.length),
    }))
const isUser = computed(() => props.sender === 'user')
// the person's attachments sit above their bubble, not inside it
const files = computed(() => (isUser.value ? parts.value.filter((p) => p.type === 'files') : []))
const body = computed(() =>
  isUser.value ? parts.value.filter((p) => p.type !== 'files') : parts.value,
)
const text = computed(() => messageText(parts.value as { type: string; text?: unknown }[]))
// Every source of the message, numbered in order, for `[1]` in Markdown
// text. The same array while the sources stay the same, so text that
// streams in does not redraw the whole reply.
let lastSources: ChatSource[] = []
const sources = computed(() => {
  const next = parts.value.flatMap((part) =>
    part.type === 'sources' ? ((part as { items?: ChatSource[] }).items ?? []) : [],
  )
  if (next.length === lastSources.length && next.every((s, i) => s === lastSources[i]))
    return lastSources
  return (lastSources = next)
})

const busy = computed(
  () =>
    props.loading ||
    parts.value.some((part) => {
      const p = part as Record<string, unknown>
      // an artifact can keep being made after the reply ends, so it doesn't hold the actions back
      const working = p.status === 'running' && p.type !== 'artifact'
      return !!p.streaming || !!p.thinking || !!p.running || working
    }),
)

const innerVersion = ref(props.versions)
const version = computed(() => Math.min(props.version ?? innerVersion.value, props.versions))
function step(delta: number) {
  const next = Math.min(Math.max(version.value + delta, 1), props.versions)
  innerVersion.value = next
  emit('update:version', next)
}

const showActions = computed(
  () =>
    !busy.value &&
    (props.versions > 1 ||
      (props.copyable && !!text.value) ||
      (props.editable && isUser.value) ||
      !!slots.actions),
)

// editing in place
const editing = ref(false)
const draft = ref('')
const editorRef = useTemplateRef<HTMLTextAreaElement>('editor')
function startEdit() {
  draft.value = text.value
  editing.value = true
  void nextTick(() => {
    const el = editorRef.value
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
    fitEditor()
  })
}
function cancelEdit() {
  editing.value = false
}
function saveEdit() {
  if (!draft.value.trim()) return
  editing.value = false
  emit('edit', draft.value)
}
function fitEditor() {
  const el = editorRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
function onEditorKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  } else if (event.key === 'Enter' && !event.shiftKey && !isComposing(event)) {
    event.preventDefault()
    saveEdit()
  }
}

const asText = (part: AnyPart) => part as Extract<ChatMessagePart, { type: 'text' }>
const asReasoning = (part: AnyPart) => part as Extract<ChatMessagePart, { type: 'reasoning' }>
const asFiles = (part: AnyPart) => part as Extract<ChatMessagePart, { type: 'files' }>
const asConfirm = (part: AnyPart) => part as ChatConfirmPart
const asArtifact = (part: AnyPart) => part as ChatArtifactPart
const known = new Set([
  'text',
  'reasoning',
  'tool',
  'steps',
  'plan',
  'sources',
  'files',
  'artifact',
  'confirm',
])
// props for the part components, without the `type` discriminator
const rest = (part: AnyPart) => {
  const { type: _type, ...others } = part as Record<string, unknown>
  return others
}
</script>

<template>
  <div
    :class="[ns.b(), ns.m(sender), ns.is('loading', loading), ns.is('editing', editing)]"
    :aria-busy="busy || undefined"
  >
    <div v-if="files.length && !editing" :class="ns.e('files')">
      <template v-for="(part, index) in files" :key="`f${index}`">
        <DouChatAttachments :model-value="asFiles(part).files" :removable="false" />
      </template>
    </div>

    <div v-if="editing" :class="ns.e('editor')">
      <textarea
        ref="editor"
        v-model="draft"
        :class="ns.e('editor-native')"
        rows="1"
        :aria-label="t('chat.edit')"
        @input="fitEditor"
        @keydown="onEditorKeydown"
      />
      <div :class="ns.e('editor-actions')">
        <DouButton size="sm" variant="ghost" @click="cancelEdit">{{ t('chat.cancel') }}</DouButton>
        <DouButton size="sm" :disabled="!draft.trim()" @click="saveEdit">
          {{ t('chat.send') }}
        </DouButton>
      </div>
    </div>

    <div v-else-if="body.length || loading || slots.default" :class="ns.e('content')">
      <slot>
        <template v-for="(part, index) in body" :key="index">
          <DouMarkdown
            v-if="part.type === 'text' && markdown && !slots.text"
            v-bind="markdownOptions"
            :class="ns.e('text')"
            :content="asText(part).text"
            :streaming="!!asText(part).streaming"
            :sources="sources.length ? sources : undefined"
          >
            <template v-for="slot in markdownSlots()" :key="slot.name" #[slot.inner]="scope">
              <slot :name="slot.name" v-bind="scope" />
            </template>
          </DouMarkdown>
          <DouStreamText
            v-else-if="part.type === 'text'"
            :class="ns.e('text')"
            :content="asText(part).text"
            :streaming="!!asText(part).streaming"
          >
            <template v-if="slots.text" #default="{ text: shown }">
              <slot
                name="text"
                :part="asText(part)"
                :text="shown"
                :index="index"
                :sources="sources"
              />
            </template>
          </DouStreamText>
          <DouChatReasoning
            v-else-if="part.type === 'reasoning'"
            :thinking="!!asReasoning(part).thinking"
            :duration="asReasoning(part).duration"
          >
            <DouMarkdown
              v-if="markdown"
              v-bind="markdownOptions"
              :content="asReasoning(part).text"
              :streaming="!!asReasoning(part).thinking"
              :caret="false"
            >
              <template v-for="slot in markdownSlots()" :key="slot.name" #[slot.inner]="scope">
                <slot :name="slot.name" v-bind="scope" />
              </template>
            </DouMarkdown>
            <DouStreamText
              v-else
              :content="asReasoning(part).text"
              :streaming="!!asReasoning(part).thinking"
              :caret="false"
            />
          </DouChatReasoning>
          <DouChatToolCall v-else-if="part.type === 'tool'" v-bind="rest(part)" />
          <DouChatSteps v-else-if="part.type === 'steps'" v-bind="rest(part)" />
          <DouChatPlan v-else-if="part.type === 'plan'" v-bind="rest(part)" />
          <DouChatSources v-else-if="part.type === 'sources'" v-bind="rest(part)" />
          <DouChatAttachments
            v-else-if="part.type === 'files'"
            :model-value="asFiles(part).files"
            :removable="false"
          />
          <DouChatArtifact
            v-else-if="part.type === 'artifact'"
            v-bind="rest(part)"
            @open="emit('artifact', asArtifact(part))"
          />
          <DouChatConfirm
            v-else-if="part.type === 'confirm'"
            :title="asConfirm(part).title"
            :description="asConfirm(part).description"
            :status="asConfirm(part).status"
            :allow-always="asConfirm(part).allowAlways"
            :tone="asConfirm(part).tone"
            @decide="emit('confirm', asConfirm(part), $event)"
          >
            <pre v-if="asConfirm(part).detail" :class="ns.e('code')">{{
              asConfirm(part).detail
            }}</pre>
          </DouChatConfirm>
          <slot
            v-else-if="!known.has(part.type)"
            name="part"
            :part="part as ChatCustomPart"
            :index="index"
          />
        </template>
      </slot>
      <span v-if="loading" :class="ns.e('loading')" role="status" :aria-label="t('chat.loading')">
        <i /><i /><i />
      </span>
    </div>

    <div v-if="showActions && !editing" :class="ns.e('actions')">
      <div
        v-if="versions > 1"
        :class="ns.e('versions')"
        role="group"
        :aria-label="t('chat.versions')"
      >
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="version <= 1"
          :aria-label="t('chat.previousVersion')"
          @click="step(-1)"
        >
          <ChevronLeftIcon />
        </DouButton>
        <span :class="ns.e('version')">{{ version }} / {{ versions }}</span>
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="version >= versions"
          :aria-label="t('chat.nextVersion')"
          @click="step(1)"
        >
          <ChevronRightIcon />
        </DouButton>
      </div>
      <DouCopyButton v-if="copyable && text" size="sm" :text="text" />
      <DouTooltip v-if="editable && isUser" :content="t('chat.edit')">
        <DouButton variant="ghost" size="sm" :aria-label="t('chat.edit')" @click="startEdit">
          <EditIcon />
        </DouButton>
      </DouTooltip>
      <slot name="actions" />
    </div>
  </div>
</template>
