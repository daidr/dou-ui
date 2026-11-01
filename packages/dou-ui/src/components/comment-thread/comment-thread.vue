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
} from './comments'
import type {
  CommentThreadEmits,
  CommentThreadExpose,
  CommentThreadProps,
  CommentThreadSlots,
} from './comment-thread'

defineOptions({ name: 'DouCommentThread' })

const props = withDefaults(defineProps<CommentThreadProps>(), {
  thread: null,
  readonly: false,
  placeholder: undefined,
  autofocus: false,
})
const emit = defineEmits<CommentThreadEmits>()
defineSlots<CommentThreadSlots>()

const ns = useNamespace('comment-thread')
const { t } = useLocale()

/** A week: older comments show their date instead of "3 days ago". */
const WEEK = 7 * 24 * 3600 * 1000

const resolved = computed(() => props.thread?.resolved)
const canWrite = computed(() => !props.readonly && !resolved.value)

function act(action: CommentAction) {
  emit('action', action)
  if (action.type === 'create') emit('update:thread', action.thread)
  else if (props.thread) {
    const next = applyCommentAction([props.thread], action)[0] ?? null
    emit('update:thread', next)
  }
}

const now = () => new Date().toISOString()

// writing a new comment or a reply
const draft = ref('')
const box = useTemplateRef<InstanceType<typeof DouTextarea>>('box')

function send() {
  const body = draft.value.trim()
  if (!body) return
  const comment: CommentItem = {
    id: createCommentId(),
    author: { ...props.author },
    body,
    createdAt: now(),
  }
  draft.value = ''
  if (props.thread) act({ type: 'reply', threadId: props.thread.id, comment })
  else act({ type: 'create', thread: { id: createCommentId(), comments: [comment] } })
}

function onBoxKeydown(event: KeyboardEvent) {
  // keys typed here are not the page's (or the editor's around it)
  event.stopPropagation()
  if (isComposing(event)) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (draft.value) draft.value = ''
    else emit('cancel')
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
  if (!id || !props.thread || !body) return
  editing.value = null
  const before = props.thread.comments.find((comment) => comment.id === id)
  if (before?.body === body) return
  act({ type: 'edit', threadId: props.thread.id, commentId: id, body, editedAt: now() })
}

function onEditKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (isComposing(event)) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    saveEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    editing.value = null
  }
}

// deleting the first comment takes the thread with it: asked first
const confirming = ref(false)

function onMenu(comment: CommentItem, index: number, value: unknown) {
  if (!props.thread) return
  if (value === 'edit') startEdit(comment)
  else if (value === 'delete') {
    if (index === 0) confirming.value = true
    else act({ type: 'delete', threadId: props.thread.id, commentId: comment.id })
  }
}

function removeThread() {
  if (!props.thread) return
  confirming.value = false
  act({ type: 'remove', threadId: props.thread.id })
}

function resolve() {
  if (props.thread)
    act({ type: 'resolve', threadId: props.thread.id, by: { ...props.author }, at: now() })
}

function reopen() {
  if (props.thread) act({ type: 'reopen', threadId: props.thread.id })
}

const placeholderText = computed(
  () =>
    props.placeholder ??
    (props.thread ? t('commentThread.replyPlaceholder') : t('commentThread.placeholder')),
)

const focus = () => box.value?.textarea?.focus({ preventScroll: true })
onMounted(() => {
  if (props.autofocus) focus()
})
defineExpose<CommentThreadExpose>({ focus })
</script>

<template>
  <div :class="[ns.b(), { 'is-resolved': !!resolved, 'is-new': !thread }]">
    <slot name="header" />
    <div v-if="resolved" :class="ns.e('status')">
      <CheckIcon :class="ns.e('status-icon')" />
      <span :class="ns.e('status-text')">{{
        t('commentThread.resolvedBy', { name: resolved.by.name })
      }}</span>
      <DouButton v-if="!readonly" variant="ghost" size="sm" @click="reopen">
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
          <div v-if="!readonly" :class="ns.e('actions')">
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
              v-if="comment.author.id === author.id && !resolved"
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
