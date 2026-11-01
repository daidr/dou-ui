<script setup lang="ts">
import { MessagePlusIcon } from '@dou-ui/icons'
import { DouButton, useFloating, useZIndex, type VirtualElement } from 'dou-ui'
import { computed, inject, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type { CommentRange } from '../core/comments'
import { editorKey } from '../editor'

/*
 * A read-only editor has no formatting toolbar; selecting text there
 * shows this one button, to start a thread on it.
 */

const { view, comments, messages } = inject(editorKey)!
const panel = shallowRef<HTMLElement | null>(null)
const range = shallowRef<CommentRange | null>(null)
const pressing = shallowRef(false)

const open = computed(
  () => !!range.value && !pressing.value && !comments.pending.value && comments.writable.value,
)

const anchor: VirtualElement = {
  getBoundingClientRect() {
    const current = view.value
    const at = range.value
    if (!current || !at) return new DOMRect()
    const first = current.coordsAtPos(at.from, 1)
    const last = current.coordsAtPos(at.to, -1)
    const right = Math.abs(first.top - last.top) < 4 ? last.right : first.left + 1
    return new DOMRect(
      first.left,
      first.top,
      Math.max(1, right - first.left),
      first.bottom - first.top,
    )
  },
}

const { style, placement } = useFloating(() => (open.value ? anchor : null), panel, {
  open,
  placement: 'top',
  offset: 8,
})
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })

function read() {
  range.value = comments.selection()
}
function onPointerDown(event: PointerEvent) {
  if (event.button === 0 && view.value?.dom.contains(event.target as Node)) pressing.value = true
}
function onPointerUp() {
  if (!pressing.value) return
  pressing.value = false
  read()
}
onMounted(() => {
  document.addEventListener('selectionchange', read)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', read)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('pointerup', onPointerUp, true)
})

function start() {
  if (comments.start()) range.value = null
}
</script>

<template>
  <Transition name="dou-floating">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-editor-bubble"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @mousedown.prevent
    >
      <DouButton size="sm" variant="ghost" @click="start">
        <template #leading><MessagePlusIcon /></template>
        {{ messages.comment }}
      </DouButton>
    </div>
  </Transition>
</template>
