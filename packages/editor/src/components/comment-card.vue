<script setup lang="ts">
import {
  DouCommentThread,
  useFloating,
  useZIndex,
  type CommentThread,
  type VirtualElement,
} from 'dou-ui'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
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

const author = computed(() => comments.author.value ?? { id: '', name: '' })

function close(refocus: boolean) {
  comments.close()
  if (refocus) view.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    close(true)
  }
}

// pressing anywhere but the card or the editor's text closes it; a press on
// the text is the editor's: it opens the thread there, or closes the card
function onPointerDown(event: PointerEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (panel.value?.contains(target) || view.value?.dom.contains(target)) return
  // menus the card opened (a comment's actions) are teleported out of it
  if ((target as Element).closest?.('.dou-floating')) return
  close(false)
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
</script>

<template>
  <Transition name="dou-floating">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-editor-comment"
      role="dialog"
      :aria-label="messages.commentThread"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @keydown="onKeydown"
    >
      <DouCommentThread
        :key="thread?.id ?? 'new'"
        :thread="thread"
        :author="author"
        :readonly="!comments.writable.value"
        :autofocus="!thread"
        @action="comments.apply"
        @cancel="close(true)"
      />
    </div>
  </Transition>
</template>
