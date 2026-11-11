<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, SmilePlusIcon } from '@dou-ui/icons'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { isComposing } from '../../utils/keyboard'
import { devWarn } from '../../utils/status-check'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { DouChatArtifact } from '../chat-artifact'
import { DouChatAttachments } from '../chat-attachments'
import { DouChatConfirm } from '../chat-confirm'
import { DouChatQuestion } from '../chat-question'
import { DouChatPlan } from '../chat-plan'
import { planRunning, type ChatPlanItem } from '../chat-plan/chat-plan'
import { DouChatReasoning } from '../chat-reasoning'
import { DouChatSources } from '../chat-sources'
import { DouChatSteps } from '../chat-steps'
import { stepsLive, type ChatStep } from '../chat-steps/chat-steps'
import { DouChatToolCall } from '../chat-tool-call'
import { useLocale } from '../config-provider/use-config'
import { DouCopyButton } from '../copy-button'
import { DouMarkdown } from '../markdown'
import { DouPopover } from '../popover'
import type { ChatSource } from '../chat-sources/chat-sources'
import { DouStreamText } from '../stream-text'
import { DouTooltip } from '../tooltip'
import { messageText } from './chat-message'
import type {
  ChatArtifactPart,
  ChatConfirmPart,
  ChatQuestionPart,
  ChatCustomPart,
  ChatMessageEmits,
  ChatMessagePart,
  ChatMessageMarkdownSlots,
  ChatMessageProps,
  ChatMessageReaction,
  ChatMessageSlots,
} from './chat-message'

defineOptions({ name: 'DouChatMessage' })

const props = withDefaults(defineProps<ChatMessageProps>(), {
  sender: 'assistant',
  loading: false,
  copyable: true,
  editable: false,
  markdown: false,
  actionsVisible: undefined,
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
    // the message's own `trailing` goes to its last text, not to every Markdown in it
    .filter((name) => name.startsWith(PREFIX) && name !== `${PREFIX}trailing`)
    .map((name) => ({
      name: name as keyof ChatMessageMarkdownSlots,
      inner: name.slice(PREFIX.length),
    }))
const isUser = computed(() => props.sender === 'user')
const actionsShow = computed(() => props.actionsVisible ?? 'hover')

// Without hover, a tap on the message shows its actions and a tap
// anywhere else hides them. Taps on its own buttons and links, and
// selecting text, leave them as they are.
const touched = ref(false)
const rootRef = useTemplateRef<HTMLElement>('root')
const INTERACTIVE = 'button, a[href], input, textarea, select, summary, [role="button"]'
function onPointerUp(event: PointerEvent) {
  if (event.pointerType === 'mouse') return
  const target = event.target as Element | null
  if (target?.closest(INTERACTIVE)) return
  if (getSelection()?.isCollapsed === false) return
  touched.value = !touched.value
}
function onOutsidePointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) touched.value = false
}
watch(touched, (on) => {
  if (on) document.addEventListener('pointerdown', onOutsidePointerDown, true)
  else document.removeEventListener('pointerdown', onOutsidePointerDown, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutsidePointerDown, true))
// the person's attachments sit above their bubble, not inside it
const files = computed(() => (isUser.value ? parts.value.filter((p) => p.type === 'files') : []))
const body = computed(() =>
  isUser.value ? parts.value.filter((p) => p.type !== 'files') : parts.value,
)
const text = computed(() => messageText(parts.value as { type: string; text?: unknown }[]))
/** The last text part, which the `trailing` slot follows; -1 without one. */
const lastText = computed(() => {
  for (let i = body.value.length - 1; i >= 0; i--) if (body.value[i]!.type === 'text') return i
  return -1
})
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
      const working = p.status === 'running' && p.type !== 'artifact' && p.live !== false
      // busy exactly when steps or a plan show themselves running
      const live = p.live as boolean | undefined
      const steps = p.type === 'steps' && stepsLive(p.items as ChatStep[] | undefined, live)
      const plan = p.type === 'plan' && planRunning(p.items as ChatPlanItem[] | undefined, live)
      return !!p.streaming || !!p.thinking || steps || plan || working
    }),
)

const innerVersion = ref(props.versions)
const version = computed(() => Math.min(props.version ?? innerVersion.value, props.versions))
function step(delta: number) {
  const next = Math.min(Math.max(version.value + delta, 1), props.versions)
  innerVersion.value = next
  emit('update:version', next)
}

// reactions
const reactions = computed(() => (props.reactions ?? []).filter((r) => r.count > 0))
const canReact = computed(() => !props.reactionsReadonly && !!slots['reaction-picker'])
const pickerOpen = ref(false)
if (process.env.NODE_ENV !== 'production') {
  watch(
    () => props.reactions,
    (list) => {
      const seen = new Set<string>()
      for (const { emoji } of list ?? []) {
        if (seen.has(emoji))
          devWarn(
            `[dou-ui] DouChatMessage: \`reactions\` lists "${emoji}" more than once; give each emoji one entry with its count.`,
          )
        seen.add(emoji)
      }
    },
    { immediate: true },
  )
}
function react(emoji: string) {
  emit(
    'react',
    emoji,
    props.reactions?.find((r) => r.emoji === emoji),
  )
}
// Picked in the panel: the add button may move from the actions to the end
// of the reactions as the first one comes in, so focus follows it there
// rather than falling back to the page.
function pick(emoji: string) {
  pickerOpen.value = false
  react(emoji)
  void nextTick(() => {
    const root = rootRef.value
    if (!root || root.contains(document.activeElement)) return
    root.querySelector<HTMLElement>(`.${ns.e('add-reaction')}`)?.focus()
  })
}
/** Read out and shown on hover: the emoji and count, then `label` when given. */
function reactionLabel(reaction: ChatMessageReaction) {
  const base = t('chat.reaction', { emoji: reaction.emoji, count: reaction.count })
  return reaction.label ? t('chat.reactionWith', { reaction: base, label: reaction.label }) : base
}
// The add button sits among the actions until the first reaction, then at
// the end of the reactions, so a message without any takes no extra line.
const addInActions = computed(() => canReact.value && !reactions.value.length)

const showActions = computed(
  () =>
    !busy.value &&
    (props.versions > 1 ||
      (props.copyable && !!text.value) ||
      (props.editable && isUser.value) ||
      addInActions.value ||
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
const asQuestion = (part: AnyPart) => part as ChatQuestionPart
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
  'question',
])
// props for the part components, without the `type` discriminator
const rest = (part: AnyPart) => {
  const { type: _type, ...others } = part as Record<string, unknown>
  return others
}
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.m(sender),
      ns.m(`actions-${actionsShow}`),
      ns.is('loading', loading),
      ns.is('editing', editing),
      ns.is('highlighted', highlighted),
      ns.is('reacting', pickerOpen),
      ns.is('touched', touched),
    ]"
    ref="root"
    :aria-busy="busy || undefined"
    :aria-current="highlighted || undefined"
    @pointerup="onPointerUp"
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
            <template v-if="slots.trailing && index === lastText" #trailing>
              <slot name="trailing" />
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
            <template v-if="slots.trailing && index === lastText" #trailing>
              <slot name="trailing" />
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
          <DouChatQuestion
            v-else-if="part.type === 'question'"
            :title="asQuestion(part).title"
            :description="asQuestion(part).description"
            :options="asQuestion(part).options"
            :status="asQuestion(part).status"
            :answer="asQuestion(part).answer"
            @select="(value, option) => emit('question', asQuestion(part), value, option)"
          />
          <slot
            v-else-if="!known.has(part.type)"
            name="part"
            :part="part as ChatCustomPart"
            :index="index"
          />
        </template>
        <div v-if="slots.trailing && lastText < 0 && !loading" :class="ns.e('trailing')">
          <slot name="trailing" />
        </div>
      </slot>
      <span v-if="loading" :class="ns.e('loading')" role="status" :aria-label="t('chat.loading')">
        <i /><i /><i />
      </span>
    </div>

    <div
      v-if="reactions.length && !editing"
      :class="ns.e('reactions')"
      role="group"
      :aria-label="t('chat.reactions')"
    >
      <DouTooltip
        v-for="reaction in reactions"
        :key="reaction.emoji"
        :content="reactionLabel(reaction)"
      >
        <!-- read only: the same chip, read out as one image with its label -->
        <span
          v-if="reactionsReadonly"
          role="img"
          :class="[ns.e('reaction'), ns.is('reacted', !!reaction.reacted), ns.is('readonly', true)]"
          :aria-label="reactionLabel(reaction)"
        >
          <span :class="ns.e('reaction-emoji')">
            <slot name="reaction" :reaction="reaction">{{ reaction.emoji }}</slot>
          </span>
          <span :class="ns.e('reaction-count')">{{ reaction.count }}</span>
        </span>
        <button
          v-else
          type="button"
          :class="[ns.e('reaction'), ns.is('reacted', !!reaction.reacted)]"
          :aria-pressed="!!reaction.reacted"
          :aria-label="reactionLabel(reaction)"
          @click="react(reaction.emoji)"
        >
          <span :class="ns.e('reaction-emoji')">
            <slot name="reaction" :reaction="reaction">{{ reaction.emoji }}</slot>
          </span>
          <span :class="ns.e('reaction-count')">{{ reaction.count }}</span>
        </button>
      </DouTooltip>
      <DouTooltip v-if="canReact" :content="t('chat.addReaction')">
        <DouPopover v-model:open="pickerOpen" placement="top-start">
          <DouButton
            variant="ghost"
            size="xs"
            :class="ns.e('add-reaction')"
            :aria-label="t('chat.addReaction')"
          >
            <SmilePlusIcon />
          </DouButton>
          <template #content="{ close }">
            <slot name="reaction-picker" :react="pick" :close="close" />
          </template>
        </DouPopover>
      </DouTooltip>
    </div>

    <!-- last in reading order, drawn at the top right of the message -->
    <div v-if="showActions && !editing" :class="ns.e('toolbar')">
      <div :class="ns.e('actions')">
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
        <DouTooltip v-if="addInActions" :content="t('chat.addReaction')">
          <DouPopover v-model:open="pickerOpen" placement="top-start">
            <DouButton
              variant="ghost"
              size="sm"
              :class="ns.e('add-reaction')"
              :aria-label="t('chat.addReaction')"
            >
              <SmilePlusIcon />
            </DouButton>
            <template #content="{ close }">
              <slot name="reaction-picker" :react="pick" :close="close" />
            </template>
          </DouPopover>
        </DouTooltip>
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
