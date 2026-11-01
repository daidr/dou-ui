<script setup lang="ts">
import { DouTooltip } from 'dou-ui'
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

const opensMenu = (item: FlowToolbarItem) => !!item.children?.length

// A button with `children` opens its choices under it; a click from the
// keyboard (no pointer, `detail` 0) puts focus on the one in use.
function press(item: FlowToolbarItem, event: MouseEvent) {
  if (!opensMenu(item)) return item.run?.()
  const button = event.currentTarget as HTMLElement
  const box = button.getBoundingClientRect()
  showMenu(item.children!, { x: box.left, y: box.bottom + 4 }, button, {
    focusChecked: event.detail === 0,
  })
}
// By key: extensions give new item objects on every update.
const warned = new Set<string>()
/** Says once when a button does nothing when pressed. */
function warnOnce(item: FlowToolbarItem) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production' || warned.has(item.key)) return
  if (item.run || opensMenu(item)) return
  warned.add(item.key)
  console.warn(
    `[@dou-ui/flow] the toolbar item "${item.key}" has no run or children: pressing it does nothing`,
  )
}
watch(
  () => props.groups,
  (groups) => groups.flat().forEach(warnOnce),
  { immediate: true },
)

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

/*
 * What it keeps clear of is read from the page, so it is read again once the
 * page has caught up with the selection: a handle drawn for the selected node
 * appears in the same update as the toolbar's new anchor.
 */
const measured = ref(0)
watch(
  () => props.anchor,
  () => measured.value++,
  { flush: 'post', immediate: true },
)

/**
 * Boxes of what the toolbar must not cover, from the editor's top left: what
 * floats over the canvas, e.g. a whiteboard's tools, and handles on the
 * selection, e.g. a whiteboard's turn handle.
 */
function overlays() {
  void measured.value
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
const place = computed(() => {
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
  return { left, top: Math.min(Math.max(top, GAP), size.height - height - GAP) }
})
const style = computed(() => ({
  left: `${Math.round(place.value.left)}px`,
  top: `${Math.round(place.value.top)}px`,
}))
/** Tips open away from the selection, so they never cover it. */
const tipPlacement = computed(() => (place.value.top < props.anchor.top ? 'top' : 'bottom'))

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
      <!-- The tip stands aside while the button's menu is open. -->
      <DouTooltip
        v-for="item in group"
        :key="item.key"
        :content="item.label"
        :shortcut="item.shortcut"
        :disabled="!!menuFrom && menuFrom === buttons.get(item.key)"
        :placement="tipPlacement"
      >
        <button
          :ref="(button) => setButton(item.key, button)"
          type="button"
          class="dou-flow-controls__button"
          :class="{ 'is-active': item.pressed }"
          :disabled="item.disabled"
          :aria-label="item.label"
          :aria-pressed="opensMenu(item) ? undefined : (item.pressed ?? undefined)"
          :aria-haspopup="opensMenu(item) ? 'menu' : undefined"
          :aria-expanded="
            opensMenu(item) ? !!menuFrom && menuFrom === buttons.get(item.key) : undefined
          "
          @click="press(item, $event)"
        >
          <component :is="item.icon" />
        </button>
      </DouTooltip>
    </template>
  </div>
</template>
