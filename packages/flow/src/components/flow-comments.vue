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
  /** The open threads there, oldest first, counted on the marker; empty for a thread being started. */
  threads: string[]
  /** The threads its card shows: the open ones, and a resolved one opened from outside. */
  shown: string[]
  /** A thread is being started here. */
  pending: boolean
  /** Where it goes, in px within the editor. */
  x: number
  y: number
  /** Above an edge's label: a finger's target keeps clear of the label. */
  lifted: boolean
  /**
   * A pin on a point of a node: its place among the open pins there, from
   * 1; `0` for one being started or a resolved one opened from outside.
   */
  number?: number
  /** The name of the node it is on, for screen readers. */
  node?: string
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

/** The marker the card belongs to: the active thread's, or the one being started. */
const current = computed<FlowCommentMarker | null>(() => {
  if (comments.pending.value) return props.markers.find((m) => m.pending) ?? null
  const id = comments.active.value
  return (id && props.markers.find((m) => m.shown.includes(id))) || null
})

/** The threads the card shows: every open one there, or the active one opened from elsewhere. */
const shown = computed<CommentThread[]>(() => {
  const marker = current.value
  if (!marker || comments.pending.value) return []
  const byId = new Map(comments.threads.value.map((t) => [t.id, t]))
  return marker.shown.flatMap((id) => byId.get(id) ?? [])
})

const open = computed(() => !!current.value)

const layer = shallowRef<HTMLElement | null>(null)
/** The marker has been panned out of the editor: the card waits, hidden, until it is back. */
const away = computed(() => {
  const marker = current.value
  const el = layer.value
  if (!marker || !el) return false
  return marker.x < 0 || marker.y < 0 || marker.x > el.clientWidth || marker.y > el.clientHeight
})

// Hiding the card drops the focus in it: give it back when the card returns.
let awayFocus: HTMLElement | null = null
watch(away, async (now) => {
  if (now) {
    const el = document.activeElement
    awayFocus = el instanceof HTMLElement && panel.value?.contains(el) ? el : null
    return
  }
  const el = awayFocus
  awayFocus = null
  await nextTick()
  const at = document.activeElement
  if (el?.isConnected && (!at || at === document.body)) el.focus({ preventScroll: true })
})

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

/**
 * When the thread being started was opened. A tap that starts one (the
 * whiteboard's comment tool) is followed by the click the browser makes
 * from it, which lands on the new pin just drawn under the finger: that
 * one doesn't close it.
 */
let startedAt = -Infinity
watch(
  () => comments.pending.value,
  (now) => now && (startedAt = performance.now()),
)

function press(marker: FlowCommentMarker, event: MouseEvent) {
  if (marker.pending && performance.now() - startedAt < 500) return
  if (current.value?.key === marker.key) return comments.close()
  // pressed from the keyboard (no clicks counted): straight into the reply box;
  // a click or tap only shows the threads, without bringing up a phone's keyboard
  const focus = event.detail === 0
  const [first] = marker.threads
  if (first) comments.show(first, focus)
  else comments.start(marker.anchor, focus)
}

const label = (marker: FlowCommentMarker) =>
  marker.number
    ? format(props.messages.commentPin, { number: marker.number, node: marker.node ?? '' })
    : marker.threads.length
      ? format(props.messages.comments, { count: marker.threads.length })
      : props.messages.comment
</script>

<template>
  <div ref="layer" class="dou-flow-editor__comments">
    <button
      v-for="marker in markers"
      :key="marker.key"
      :ref="
        (el) => (el ? markerEls.set(marker.key, el as HTMLElement) : markerEls.delete(marker.key))
      "
      type="button"
      class="dou-flow-editor__comment"
      :class="{
        'is-active': current?.key === marker.key,
        'is-new': !marker.threads.length,
        'is-node': 'node' in marker.anchor && marker.number === undefined,
        'is-pin': marker.number !== undefined,
        'is-lifted': marker.lifted,
      }"
      :style="{ translate: `${marker.x}px ${marker.y}px` }"
      :aria-label="label(marker)"
      :aria-expanded="current?.key === marker.key"
      @click="press(marker, $event)"
    >
      <span v-if="marker.number" class="dou-flow-editor__comment-count">{{ marker.number }}</span>
      <template v-else>
        <MessageCircleIcon aria-hidden="true" />
        <span
          v-if="marker.number === undefined && marker.threads.length > 1"
          class="dou-flow-editor__comment-count"
          >{{ marker.threads.length }}</span
        >
      </template>
    </button>
  </div>
  <Transition name="dou-floating" @after-leave="onClosed">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-flow-editor__comment-card"
      :class="{ 'is-away': away }"
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
