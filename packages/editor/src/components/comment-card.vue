<script setup lang="ts">
import {
  DouCommentThread,
  useFloating,
  useLayer,
  useZIndex,
  type CommentThread,
  type VirtualElement,
} from 'dou-ui'
import { computed, inject, nextTick, shallowRef, watch } from 'vue'
import { commentRange, type CommentRange } from '../core/comments'
import { editorKey } from '../editor'

/*
 * The thread a piece of text is about, beside that text: opened by a
 * click on highlighted text or `v-model:active-comment`, or empty while
 * a new thread's first comment is being written.
 */

const { view, state, comments, messages } = inject(editorKey)!
const panel = shallowRef<HTMLElement | null>(null)

const thread = computed<CommentThread | null>(() => {
  const id = comments.active.value
  return (id && comments.threads.value.find((item) => item.id === id)) || null
})

const range = computed<CommentRange | null>(() => {
  if (comments.pending.value) return comments.pending.value
  const current = state.value
  return thread.value && current ? commentRange(current.doc, thread.value.id) : null
})

const open = computed(() => !!range.value)

const anchor: VirtualElement = {
  getBoundingClientRect() {
    const current = view.value
    const at = range.value
    if (!current || !at) return new DOMRect()
    const start = current.coordsAtPos(at.from, 1)
    const end = current.coordsAtPos(at.to, -1)
    // text over several lines: from its start to the editor's right edge
    const right =
      Math.abs(start.top - end.top) < 4
        ? end.right
        : Math.max(start.left + 1, current.dom.getBoundingClientRect().right)
    return new DOMRect(
      start.left,
      start.top,
      Math.max(1, right - start.left),
      end.bottom - start.top,
    )
  },
}

const { style, placement, update } = useFloating(() => (open.value ? anchor : null), panel, {
  open,
  placement: 'bottom-start',
  offset: 6,
})
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })
watch(state, () => open.value && void nextTick(update))

const threadView = shallowRef<InstanceType<typeof DouCommentThread> | null>(null)

/** Focus was in the card, or went nowhere when what held it went away. */
const focusLost = () => {
  const el = document.activeElement
  return !el || el === document.body || !!panel.value?.contains(el)
}

function close() {
  const refocus = focusLost()
  comments.close()
  if (refocus) view.value?.focus()
}

// the card is a layer: Escape goes to a menu opened from it first, and a
// press on such a menu isn't outside. A press on the editor's text is the
// editor's: it opens the thread there, or closes the card.
useLayer({
  open,
  elements: () => [panel.value, view.value?.dom],
  onEscape: () => close(),
  onOutside: () => comments.close(),
})

// asked to (by the keyboard shortcut, or a thread just started): the reply box
watch(
  () => comments.focusRequest.value,
  async () => {
    await nextTick()
    await nextTick()
    threadView.value?.focus()
  },
)

// a thread resolved or removed from the card: back to the text, once
// the card is gone (focus can sit in it while it fades out)
function onClosed() {
  const el = document.activeElement
  if (!el || el === document.body) view.value?.focus()
}
</script>

<template>
  <Transition name="dou-floating" @after-leave="onClosed">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-editor-comment"
      role="dialog"
      :aria-label="messages.commentThread"
      :style="[style, { zIndex }]"
      :data-placement="placement"
    >
      <DouCommentThread
        ref="threadView"
        :key="thread?.id ?? 'new'"
        :thread="thread"
        :author="comments.author.value"
        :readonly="!comments.writable.value"
        :autofocus="!thread"
        @action="comments.apply"
        @cancel="close"
      />
    </div>
  </Transition>
</template>
