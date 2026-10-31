<script setup lang="ts">
import { computed, ref, shallowReactive, useTemplateRef, watch } from 'vue'
import { useFlowEditor } from '../context'
import type { FlowToolbarItem } from '../core/menu'

const props = defineProps<{
  /** Each extension's buttons, with a divider between them. */
  groups: FlowToolbarItem[][]
  /** The selection on screen, in px from the editor's top left. */
  anchor: {
    x: number
    top: number
    bottom: number
    /** Boxes it should rather not cover, e.g. nodes beside selected edges, in the same px. */
    avoid?: { left: number; top: number; right: number; bottom: number }[]
  }
  size: { width: number; height: number }
}>()

const { messages, root, showMenu, menuFrom } = useFlowEditor()

// A button with `menu` opens its choices under it; a click from the
// keyboard (no pointer, `detail` 0) puts focus on the one in use.
function press(item: FlowToolbarItem, event: MouseEvent) {
  if (!item.menu) return item.run?.(event)
  const button = event.currentTarget as HTMLElement
  const box = button.getBoundingClientRect()
  showMenu(item.menu(), { x: box.left, y: box.bottom + 4 }, button, {
    focusChecked: event.detail === 0,
  })
}
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

/** Boxes of what floats over the canvas, e.g. a whiteboard's tools, from the editor's top left. */
function overlays() {
  const editor = root.value
  if (!editor) return []
  const origin = editor.getBoundingClientRect()
  return [...editor.querySelectorAll<HTMLElement>('[data-flow-overlay]')].map((item) => {
    const r = item.getBoundingClientRect()
    return {
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    }
  })
}

// Above the selection, below it when there is no room or it would cover
// something floating there, kept inside the editor.
const style = computed(() => {
  const { width, height } = box.value
  const { anchor, size } = props
  const left = Math.min(Math.max(anchor.x - width / 2, GAP), size.width - width - GAP)
  const above = anchor.top - GAP - height
  const under = anchor.bottom + GAP
  const boxes = [...overlays(), ...(anchor.avoid ?? [])]
  const hits = (top: number) =>
    boxes.filter(
      (o) => left < o.right && left + width > o.left && top < o.bottom && top + height > o.top,
    )
  const fits = (top: number) => top >= GAP && top + height <= size.height - GAP && !hits(top).length
  // Above, else below; when something is in the way, just past it.
  const candidates = [above, under]
  const over = hits(above)
  if (over.length) candidates.push(Math.min(...over.map((o) => o.top)) - GAP - height)
  const beneath = hits(under)
  if (beneath.length) candidates.push(Math.max(...beneath.map((o) => o.bottom)) + GAP)
  const top = candidates.find(fits) ?? (above >= GAP ? above : under)
  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(Math.min(Math.max(top, GAP), size.height - height - GAP))}px`,
  }
})

/** The buttons by key, to tell which one opened the menu. */
const buttons = shallowReactive(new Map<string, Element>())
function setButton(key: string, button: unknown) {
  if (button instanceof Element) buttons.set(key, button)
  else buttons.delete(key)
}

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
        :aria-pressed="item.menu ? undefined : (item.active ?? undefined)"
        :aria-haspopup="item.menu ? 'menu' : undefined"
        :aria-expanded="item.menu ? !!menuFrom && menuFrom === buttons.get(item.key) : undefined"
        :title="item.label"
        :ref="(button) => setButton(item.key, button)"
        @click="press(item, $event)"
      >
        <component :is="item.icon" />
      </button>
    </template>
  </div>
</template>
