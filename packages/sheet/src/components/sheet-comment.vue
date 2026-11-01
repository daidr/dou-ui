<script setup lang="ts">
import {
  DouCommentThread,
  useFloating,
  useLayer,
  useZIndex,
  type CommentAction,
  type CommentAuthor,
  type CommentThread,
  type VirtualElement,
} from 'dou-ui'
import { nextTick, shallowRef, watch } from 'vue'

/*
 * The thread about a cell, beside the cell: opened by a click on the cell,
 * `Mod+Alt+M`, the menu or `v-model:active-comment`; or empty while a new
 * thread's first comment is being written.
 */

const props = defineProps<{
  /** The cell it is about. */
  anchor: VirtualElement
  /** The thread; `null` to write the first comment. */
  thread: CommentThread | null
  author?: CommentAuthor
  readonly: boolean
  label: string
  /** Bumped to put the cursor in the reply box. */
  focusRequest: number
  /** The last request the cursor was put there for; a card opened for a newer one takes it. */
  focusHandled: number
  /** What belongs to the grid: a press there is the grid's, not outside the card. */
  grid: () => HTMLElement | null
}>()

const emit = defineEmits<{
  action: [action: CommentAction]
  /** Escape, the cancel button, or a press outside. `refocus` asks for the grid's focus back. */
  close: [refocus: boolean]
  /** The request the cursor was put in the reply box for. */
  focused: [request: number]
}>()

const panel = shallowRef<HTMLElement | null>(null)
const threadView = shallowRef<InstanceType<typeof DouCommentThread> | null>(null)

/**
 * Beside the cell, or under it (above when there's no room below) on a
 * screen too narrow for the card on either side, so it never covers the
 * cell it is about.
 */
function side(): 'right-start' | 'bottom-start' {
  if (typeof window === 'undefined') return 'right-start'
  const anchor = props.anchor.getBoundingClientRect()
  const width = panel.value?.offsetWidth ?? 340
  const room = Math.max(window.innerWidth - anchor.right, anchor.left)
  return room >= width + 6 ? 'right-start' : 'bottom-start'
}

const { style, placement } = useFloating(() => props.anchor, panel, {
  open: true,
  placement: side,
  offset: 6,
})
const zIndex = useZIndex().next()

/** Focus was in the card, or went nowhere when what held it went away. */
const focusLost = () => {
  const el = document.activeElement
  return !el || el === document.body || !!panel.value?.contains(el)
}

// a layer: Escape goes to a menu opened from it first, and a press on such
// a menu isn't outside. A press on the grid is the grid's: it opens the
// thread of the cell pressed, or closes the card.
useLayer({
  open: true,
  elements: () => [panel.value, props.grid()],
  onEscape: () => emit('close', focusLost()),
  onOutside: () => emit('close', false),
})

// asked to (the keyboard shortcut, a thread just started): the reply box,
// also when the card opens for the request
watch(
  () => props.focusRequest,
  async (request) => {
    if (request <= props.focusHandled) return
    emit('focused', request)
    await nextTick()
    threadView.value?.focus()
  },
  { flush: 'post', immediate: true },
)

defineExpose({ panel })
</script>

<template>
  <Transition name="dou-floating" appear>
    <div
      ref="panel"
      class="dou-floating dou-sheet-comment"
      role="dialog"
      :aria-label="label"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @pointerdown.stop
      @contextmenu.stop
      @wheel.stop
    >
      <DouCommentThread
        ref="threadView"
        :key="thread?.id ?? 'new'"
        :thread="thread"
        :author="author"
        :readonly="readonly"
        :autofocus="!thread"
        @action="emit('action', $event)"
        @cancel="emit('close', true)"
      />
    </div>
  </Transition>
</template>
