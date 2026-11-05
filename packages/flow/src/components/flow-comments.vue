<script setup lang="ts">
import { MessageCircleIcon } from '@dou-ui/icons'
import {
  DouCommentThread,
  useFloating,
  useLayer,
  useZIndex,
  type CommentThread,
  type VirtualElement,
} from 'dou-ui'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import type { FlowComments } from '../comments'
import type { FlowCommentAnchor } from '../context'
import { format, type FlowMessages } from '../locale'

/*
 * The comments over the canvas: a marker on each node and edge with open
 * threads, and the card with the threads of the one opened, or the box
 * for a thread being started.
 */

export interface FlowCommentMarker {
  key: string
  anchor: FlowCommentAnchor
  /** The open threads there, oldest first; empty for a thread being started. */
  threads: string[]
  /** Where it goes, in px within the editor. */
  x: number
  y: number
}

const props = defineProps<{
  comments: FlowComments
  markers: FlowCommentMarker[]
  messages: FlowMessages
  /** Gives the focus back to what a thread is about, after the card closes. */
  restore: (anchor: FlowCommentAnchor | null) => void
}>()

const { comments } = props
const panel = shallowRef<HTMLElement | null>(null)
const markerEls = new Map<string, HTMLElement>()

const keyOf = (anchor: FlowCommentAnchor) =>
  'node' in anchor ? `n:${anchor.node}` : `e:${anchor.edge}`

/** The marker the card belongs to: the active thread's, or the one being started. */
const current = computed<FlowCommentMarker | null>(() => {
  const pending = comments.pending.value
  if (pending) return props.markers.find((m) => m.key === keyOf(pending)) ?? null
  const id = comments.active.value
  return (id && props.markers.find((m) => m.threads.includes(id))) || null
})

/** The threads the card shows: every open one there, or the active one opened from elsewhere. */
const shown = computed<CommentThread[]>(() => {
  const marker = current.value
  if (!marker || comments.pending.value) return []
  const byId = new Map(comments.threads.value.map((t) => [t.id, t]))
  return marker.threads.flatMap((id) => byId.get(id) ?? [])
})

const open = computed(() => !!current.value)

const anchor: VirtualElement = {
  getBoundingClientRect() {
    const marker = current.value
    const el = marker && markerEls.get(marker.key)
    return el ? el.getBoundingClientRect() : new DOMRect()
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
// follows its marker as the canvas pans and zooms
watch(
  () => current.value && [current.value.x, current.value.y],
  () => open.value && void nextTick(update),
)

let lastAnchor: FlowCommentAnchor | null = null
watch(current, (marker) => marker && (lastAnchor = marker.anchor), { immediate: true })

const focusLost = () => {
  const el = document.activeElement
  return !el || el === document.body || !!panel.value?.contains(el)
}

function close() {
  const refocus = focusLost()
  comments.close()
  if (refocus) props.restore(lastAnchor)
}

useLayer({
  open,
  elements: () => [panel.value, ...markerEls.values()],
  onEscape: () => close(),
  onOutside: () => comments.close(),
})

const views = useTemplateRef<InstanceType<typeof DouCommentThread>[]>('views')
// asked to (the keyboard shortcut, or a thread just started): the reply box
watch(
  () => comments.focusRequest.value,
  async () => {
    await nextTick()
    await nextTick()
    const id = comments.active.value
    const index = shown.value.findIndex((t) => t.id === id)
    views.value?.[Math.max(0, index)]?.focus()
  },
)

// a thread resolved or removed from the card: back to what it is about,
// once the card is gone
function onClosed() {
  const el = document.activeElement
  if (!el || el === document.body) props.restore(lastAnchor)
}

function press(marker: FlowCommentMarker) {
  if (current.value?.key === marker.key) return comments.close()
  comments.start(marker.anchor)
}

const label = (marker: FlowCommentMarker) =>
  format(props.messages.comments, { count: marker.threads.length })
</script>

<template>
  <div class="dou-flow-editor__comments">
    <button
      v-for="marker in markers"
      :key="marker.key"
      :ref="
        (el) => (el ? markerEls.set(marker.key, el as HTMLElement) : markerEls.delete(marker.key))
      "
      type="button"
      class="dou-flow-editor__comment"
      :class="{ 'is-active': current?.key === marker.key, 'is-new': !marker.threads.length }"
      :style="{ translate: `${marker.x}px ${marker.y}px` }"
      :aria-label="marker.threads.length ? label(marker) : messages.comment"
      :aria-expanded="current?.key === marker.key"
      @click="press(marker)"
    >
      <MessageCircleIcon aria-hidden="true" />
      <span v-if="marker.threads.length > 1" class="dou-flow-editor__comment-count">{{
        marker.threads.length
      }}</span>
    </button>
  </div>
  <Transition name="dou-floating" @after-leave="onClosed">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-flow-editor__comment-card"
      role="dialog"
      :aria-label="messages.comment"
      :style="[style, { zIndex }]"
      :data-placement="placement"
    >
      <template v-if="comments.pending.value">
        <DouCommentThread
          ref="views"
          key="new"
          :thread="null"
          :author="comments.author.value"
          autofocus
          @action="comments.apply"
          @cancel="close"
        />
      </template>
      <template v-else>
        <DouCommentThread
          v-for="thread in shown"
          :key="thread.id"
          ref="views"
          :thread="thread"
          :author="comments.author.value"
          :readonly="!comments.writable.value"
          @action="comments.apply"
          @cancel="close"
        />
      </template>
    </div>
  </Transition>
</template>
