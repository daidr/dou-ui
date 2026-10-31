<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useFlowEditor } from '../context'
import type { FlowToolbarItem } from '../core/menu'

const props = defineProps<{
  /** Each extension's buttons, with a divider between them. */
  groups: FlowToolbarItem[][]
  /** The selection on screen, in px from the editor's top left. */
  anchor: { x: number; top: number; bottom: number }
  size: { width: number; height: number }
}>()

const { messages } = useFlowEditor()
const el = useTemplateRef<HTMLElement>('el')
const box = ref({ width: 0, height: 0 })

watch(
  [el, () => props.groups],
  () => {
    if (el.value) box.value = { width: el.value.offsetWidth, height: el.value.offsetHeight }
  },
  { flush: 'post' },
)

/** Room between the toolbar and the selection, and the editor's edges. */
const GAP = 8

// Above the selection, below it when there is no room, kept inside the editor.
const style = computed(() => {
  const { width, height } = box.value
  const { anchor, size } = props
  const below = anchor.top - GAP - height < GAP
  const top = below ? anchor.bottom + GAP : anchor.top - GAP - height
  const left = Math.min(Math.max(anchor.x - width / 2, GAP), size.width - width - GAP)
  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(Math.min(Math.max(top, GAP), size.height - height - GAP))}px`,
  }
})

// The selection scrolled out of view: nothing to point at.
const hidden = computed(
  () =>
    props.anchor.bottom < 0 ||
    props.anchor.top > props.size.height ||
    props.anchor.x < 0 ||
    props.anchor.x > props.size.width,
)
</script>

<template>
  <div
    v-show="!hidden"
    ref="el"
    class="dou-flow-toolbar"
    role="toolbar"
    :aria-label="messages.toolbar"
    :style="style"
  >
    <template v-for="(group, i) in groups" :key="i">
      <span v-if="i > 0" class="dou-flow-controls__divider" />
      <button
        v-for="item in group"
        :key="item.key"
        type="button"
        class="dou-flow-controls__button"
        :class="{ 'is-active': item.active }"
        :disabled="item.disabled"
        :aria-label="item.label"
        :aria-pressed="item.active ?? undefined"
        :title="item.label"
        @click="item.run($event)"
      >
        <component :is="item.icon" />
      </button>
    </template>
  </div>
</template>
