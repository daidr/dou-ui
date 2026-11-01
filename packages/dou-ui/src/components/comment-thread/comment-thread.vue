<script setup lang="ts">
import { CheckIcon, MoreHorizontalIcon, RotateCcwIcon } from '@dou-ui/icons'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { isComposing } from '../../utils/keyboard'
import { useNamespace } from '../../utils/namespace'
import DouAvatar from '../avatar/avatar.vue'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import DouDropdown from '../dropdown/dropdown.vue'
import DouDropdownItem from '../dropdown/dropdown-item.vue'
import DouRelativeTime from '../relative-time/relative-time.vue'
import DouTextarea from '../textarea/textarea.vue'
import DouTooltip from '../tooltip/tooltip.vue'
import {
  applyCommentAction,
  createCommentId,
  type CommentAction,
  type CommentItem,
  type CommentThread,
} from './comments'
import type {
  CommentThreadEmits,
  CommentThreadExpose,
  CommentThreadProps,
  CommentThreadSlots,
} from './comment-thread'

defineOptions({ name: 'DouCommentThread' })

const props = withDefaults(defineProps<CommentThreadProps>(), {
  author: undefined,
  readonly: false,
  placeholder: undefined,
  autofocus: false,
})
// without `v-model:thread`, the thread is kept here
const thread = defineModel<CommentThread | null>('thread', { default: null })
const emit = defineEmits<{
  action: CommentThreadEmits['action']
  cancel: CommentThreadEmits['cancel']
}>()
defineSlots<CommentThreadSlots>()

const ns = useNamespace('comment-thread')
const { t } = useLocale()

/** A week: older comments show their date instead of "3 days ago". */
const WEEK = 7 * 24 * 3600 * 1000

const resolved = computed(() => thread.value?.resolved)
/** Who may change things: nobody when read-only, or when no `author` says who is writing. */
const writer = computed(() => (props.readonly ? undefined : props.author))
const canWrite = computed(() => !!writer.value && !resolved.value)

const root = useTemplateRef<HTMLElement>('root')

function act(action: CommentAction) {
  emit('action', action)
  if (action.type === 'create') thread.value = action.thread
  else if (thread.value) thread.value = applyCommentAction([thread.value], action)[0] ?? null
  void keepFocus()
}

/**
 * The button or box that held focus can go with a change (the edit box
 * once saved, the reply box once resolved): focus moves on to the reply
 * box, or the reopen button, instead of falling to the page.
 */
async function keepFocus() {
  await nextTick()
  const el = root.value
  const now = document.activeElement
  if (!el || (now && now !== document.body && !el.contains(now))) return
  if (now && now !== document.body && el.contains(now) && now.isConnected) return
  if (box.value) focus()
  else el.querySelector<HTMLElement>(`.${ns.e('status')} button`)?.focus({ preventScroll: true })
}

const now = () => new Date().toISOString()

// writing a new comment or a reply
const draft = ref('')
const box = useTemplateRef<InstanceType<typeof DouTextarea>>('box')

function send() {
  const body = draft.value.trim()
  const author = writer.value
  if (!body || !author) return
  const comment: CommentItem = {
    id: createCommentId(),
    author: { ...author },
    body,
    createdAt: now(),
  }
  draft.value = ''
  if (thread.value) act({ type: 'reply', threadId: thread.value.id, comment })
  else act({ type: 'create', thread: { id: createCommentId(), comments: [comment] } })
}

/** A key handled here: not the page's too. */
function handled(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function onBoxKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  if (event.key === 'Enter' && !event.shiftKey) {
    handled(event)
    send()
  } else if (event.key === 'Escape') {
    // an empty box lets Escape go on, to close the popover or drawer around
    if (draft.value) {
      handled(event)
      draft.value = ''
    } else emit('cancel')
  }
}

// changing a comment in place
const editing = ref<string | null>(null)
const editDraft = ref('')
const editBox = useTemplateRef<InstanceType<typeof DouTextarea>[]>('editBox')

function startEdit(comment: CommentItem) {
  confirming.value = false
  editing.value = comment.id
  editDraft.value = comment.body
  void nextTick(() => {
    const el = editBox.value?.[0]?.textarea
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  })
}

function saveEdit() {
  const id = editing.value
  const body = editDraft.value.trim()
  if (!id || !thread.value || !body) return
  editing.value = null
  const before = thread.value.comments.find((comment) => comment.id === id)
  if (before?.body === body) return void keepFocus()
  act({ type: 'edit', threadId: thread.value.id, commentId: id, body, editedAt: now() })
}

function onEditKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  if (event.key === 'Enter' && !event.shiftKey) {
    handled(event)
    saveEdit()
  } else if (event.key === 'Escape') {
    handled(event)
    editing.value = null
    void keepFocus()
  }
}

// deleting the first comment takes the thread with it: asked first
const confirming = ref(false)

function onMenu(comment: CommentItem, index: number, value: unknown) {
  if (!thread.value) return
  if (value === 'edit') startEdit(comment)
  else if (value === 'delete') {
    if (index === 0) confirming.value = true
    else act({ type: 'delete', threadId: thread.value.id, commentId: comment.id })
  }
}

function removeThread() {
  if (!thread.value) return
  confirming.value = false
  act({ type: 'remove', threadId: thread.value.id })
}

function resolve() {
  const by = writer.value
  if (thread.value && by)
    act({ type: 'resolve', threadId: thread.value.id, by: { ...by }, at: now() })
}

function reopen() {
  if (thread.value) act({ type: 'reopen', threadId: thread.value.id })
}

const placeholderText = computed(() =>
  thread.value
    ? t('commentThread.replyPlaceholder')
    : (props.placeholder ?? t('commentThread.placeholder')),
)

const focus = () => box.value?.textarea?.focus({ preventScroll: true })
onMounted(() => {
  if (props.autofocus) focus()
})
defineExpose<CommentThreadExpose>({ focus })
</script>

<template>
  <div ref="root" role="group" :class="[ns.b(), { 'is-resolved': !!resolved, 'is-new': !thread }]">
    <slot name="header" />
    <div v-if="resolved" :class="ns.e('status')">
      <CheckIcon :class="ns.e('status-icon')" />
      <span :class="ns.e('status-text')">{{
        t('commentThread.resolvedBy', { name: resolved.by.name })
      }}</span>
      <DouButton v-if="writer" variant="ghost" size="sm" @click="reopen">
        <template #leading><RotateCcwIcon /></template>
        {{ t('commentThread.reopen') }}
      </DouButton>
    </div>
    <ol v-if="thread?.comments.length" :class="ns.e('list')">
      <li v-for="(comment, index) in thread.comments" :key="comment.id" :class="ns.e('comment')">
        <div :class="ns.e('head')">
          <DouAvatar
            :name="comment.author.name"
            :src="comment.author.avatar"
            size="sm"
            :class="ns.e('avatar')"
          />
          <span :class="ns.e('author')">{{ comment.author.name }}</span>
          <DouRelativeTime
            :value="comment.createdAt"
            short
            :absolute-after="WEEK"
            :class="ns.e('time')"
          />
          <span v-if="comment.editedAt" :class="ns.e('edited')">{{
            t('commentThread.edited')
          }}</span>
          <div v-if="writer" :class="ns.e('actions')">
            <DouTooltip v-if="index === 0 && !resolved" :content="t('commentThread.resolve')">
              <DouButton
                variant="ghost"
                size="sm"
                :aria-label="t('commentThread.resolve')"
                @click="resolve"
              >
                <CheckIcon />
              </DouButton>
            </DouTooltip>
            <DouDropdown
              v-if="comment.author.id === writer.id && !resolved"
              placement="bottom-end"
              @select="(value) => onMenu(comment, index, value)"
            >
              <DouButton variant="ghost" size="sm" :aria-label="t('commentThread.more')">
                <MoreHorizontalIcon />
              </DouButton>
              <template #menu>
                <DouDropdownItem value="edit">{{ t('commentThread.edit') }}</DouDropdownItem>
                <DouDropdownItem value="delete" tone="danger">{{
                  index === 0 ? t('commentThread.deleteThread') : t('commentThread.delete')
                }}</DouDropdownItem>
              </template>
            </DouDropdown>
          </div>
        </div>
        <div v-if="editing === comment.id" :class="ns.e('editor')">
          <DouTextarea
            ref="editBox"
            v-model="editDraft"
            :autosize="{ minRows: 1, maxRows: 8 }"
            size="sm"
            @keydown="onEditKeydown"
          />
          <div :class="ns.e('buttons')">
            <DouButton variant="ghost" size="sm" @click="editing = null">{{
              t('commentThread.cancel')
            }}</DouButton>
            <DouButton
              variant="solid"
              tone="primary"
              size="sm"
              :disabled="!editDraft.trim()"
              @click="saveEdit"
              >{{ t('commentThread.save') }}</DouButton
            >
          </div>
        </div>
        <p v-else :class="ns.e('body')">{{ comment.body }}</p>
        <div v-if="index === 0 && confirming" :class="ns.e('confirm')" role="alert">
          <span>{{ t('commentThread.deleteThreadConfirm') }}</span>
          <div :class="ns.e('buttons')">
            <DouButton variant="ghost" size="sm" @click="confirming = false">{{
              t('commentThread.cancel')
            }}</DouButton>
            <DouButton variant="solid" tone="danger" size="sm" @click="removeThread">{{
              t('commentThread.delete')
            }}</DouButton>
          </div>
        </div>
      </li>
    </ol>
    <div v-if="canWrite" :class="ns.e('composer')">
      <DouTextarea
        ref="box"
        v-model="draft"
        :autosize="{ minRows: 1, maxRows: 8 }"
        :placeholder="placeholderText"
        :aria-label="placeholderText"
        size="sm"
        @keydown="onBoxKeydown"
      />
      <div v-if="draft || !thread" :class="ns.e('buttons')">
        <DouButton v-if="!thread" variant="ghost" size="sm" @click="emit('cancel')">{{
          t('commentThread.cancel')
        }}</DouButton>
        <DouButton
          variant="solid"
          tone="primary"
          size="sm"
          :disabled="!draft.trim()"
          @click="send"
          >{{ t('commentThread.send') }}</DouButton
        >
      </div>
    </div>
  </div>
</template>
