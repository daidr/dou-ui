<script setup lang="ts">
import { DouCommentThread, useFloating, useLayer, useZIndex, type VirtualElement } from 'dou-ui'
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import type { DashboardMessages } from '../locale'
import type { DashboardComments } from './comments'

/*
 * The card with a widget's discussions, by the comment button in its title
 * bar: every open thread there, or the box for a thread being started.
 */

const props = defineProps<{
  comments: DashboardComments
  messages: DashboardMessages
  /** The comment button of a widget, to put the card by and give the focus back to. */
  buttonOf: (widget: string) => HTMLElement | null
  /** Where the card goes: the button, or the widget while its button isn't drawn yet. */
  placeOf: (widget: string) => HTMLElement | null
}>()

const { comments } = props
const panel = shallowRef<HTMLElement | null>(null)
const open = computed(() => !!comments.current.value)

const anchor: VirtualElement = {
  getBoundingClientRect() {
    const widget = comments.current.value
    const el = widget && props.placeOf(widget)
    return el ? el.getBoundingClientRect() : new DOMRect()
  },
}

const { style, placement, update } = useFloating(() => (open.value ? anchor : null), panel, {
  open,
  placement: 'bottom-end',
  offset: 6,
})
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })

// a widget far from the view is drawn once it is scrolled to: then the card moves to its button
let frame = 0
watch(
  () => comments.current.value,
  (widget) => {
    cancelAnimationFrame(frame)
    if (!widget || props.buttonOf(widget)) return
    let tries = 60
    const wait = () => {
      if (comments.current.value !== widget) return
      if (props.buttonOf(widget)) return update()
      update()
      if (--tries > 0) frame = requestAnimationFrame(wait)
    }
    frame = requestAnimationFrame(wait)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

let lastWidget: string | null = null
watch(comments.current, (widget) => widget && (lastWidget = widget), { immediate: true })

function restore() {
  const el = lastWidget ? props.buttonOf(lastWidget) : null
  el?.focus({ preventScroll: true })
}

const focusLost = () => {
  const el = document.activeElement
  return !el || el === document.body || !!panel.value?.contains(el)
}

function close() {
  const refocus = focusLost()
  comments.close()
  if (refocus) restore()
}

useLayer({
  open,
  elements: () => {
    const widget = comments.current.value
    return [panel.value, widget ? props.buttonOf(widget) : null]
  },
  onEscape: () => close(),
  onOutside: () => comments.close(),
})

const views = useTemplateRef<InstanceType<typeof DouCommentThread>[]>('views')
// asked to (the shortcut, the button, a thread just started): the reply box
watch(
  () => comments.focusRequest.value,
  async () => {
    await nextTick()
    await nextTick()
    const id = comments.active.value
    const index = comments.shown.value.findIndex((t) => t.id === id)
    views.value?.[Math.max(0, index)]?.focus()
  },
)

// a thread resolved or removed from the card: back to the button, once the card is gone
function onClosed() {
  const el = document.activeElement
  if (!el || el === document.body) restore()
}
</script>

<template>
  <Transition name="dou-floating" @after-leave="onClosed">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-dashboard__comment-card"
      role="dialog"
      :aria-label="messages.comment"
      :style="[style, { zIndex }]"
      :data-placement="placement"
    >
      <DouCommentThread
        v-if="comments.pending.value"
        ref="views"
        key="new"
        :thread="null"
        :author="comments.author.value"
        autofocus
        @action="comments.apply"
        @cancel="close"
      />
      <template v-else>
        <DouCommentThread
          v-for="thread in comments.shown.value"
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
