<script setup lang="ts">
import {
  CircleIcon,
  CursorIcon,
  DiamondIcon,
  EraserIcon,
  HandGrabIcon,
  HandIcon,
  ImageIcon,
  MessagePlusIcon,
  PencilIcon,
  SquareIcon,
  StickyNoteIcon,
  TypeIcon,
} from '@dou-ui/icons'
import { DouTooltip, scrollPositionOf } from 'dou-ui'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch, type Component } from 'vue'
import { useFlowEditor } from '../context'
import { pickImages } from './image'
import { imageKey, whiteboardKeys, type WhiteboardTool } from './model'
import { boardState, usable } from './state'

defineOptions({ name: 'DouWhiteboardToolbar' })

const ctx = useFlowEditor()
const state = boardState(ctx)
const t = computed(() => ctx.messages.value.board)

const all: { tool: WhiteboardTool; icon: Component }[][] = [
  [
    { tool: 'select', icon: CursorIcon },
    { tool: 'hand', icon: HandIcon },
  ],
  [
    { tool: 'rect', icon: SquareIcon },
    { tool: 'ellipse', icon: CircleIcon },
    { tool: 'diamond', icon: DiamondIcon },
  ],
  [
    { tool: 'sticky', icon: StickyNoteIcon },
    { tool: 'text', icon: TypeIcon },
  ],
  [
    { tool: 'pen', icon: PencilIcon },
    { tool: 'eraser', icon: EraserIcon },
  ],
  [{ tool: 'comment', icon: MessagePlusIcon }],
]

/** The tools that can be used now: while read-only, select, hand and comment; comment while threads can be started. */
const groups = computed(() =>
  all
    .map((group) => group.filter((item) => usable(ctx, item.tool)))
    .filter((group) => group.length),
)

/** Tools that go back to select after one use, unless kept with a double click. */
const once = new Set<WhiteboardTool>(['rect', 'ellipse', 'diamond', 'sticky', 'text'])

// A click picks the tool for one use; a double click keeps it. Focus goes
// back to the canvas, where the tool is used and its keys work.
function pick(tool: WhiteboardTool, keep: boolean) {
  state.tool.value = tool
  state.locked.value = keep && once.has(tool)
  ctx.root.value?.focus({ preventScroll: true })
}

function insertImage() {
  pickImages(ctx)
}

// Too narrow for every tool: one row that scrolls sideways, faded at the
// side with more, and the tool in hand kept in view.
const el = useTemplateRef<HTMLElement>('el')
const more = ref({ start: false, end: false })
/** Right to left; read when the row is laid out, not on every scroll. */
let rtl = false
function measure() {
  const box = el.value
  if (!box) return
  // from the start, also right to left, and kept in range while the row bounces
  const left = Math.abs(scrollPositionOf(box, rtl).left)
  const rest = box.scrollWidth - box.clientWidth - left
  more.value = { start: left > 1, end: rest > 1 }
}
let observer: ResizeObserver | undefined
watch(
  el,
  (box) => {
    observer?.disconnect()
    if (!box || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(() => {
      rtl = getComputedStyle(box).direction === 'rtl'
      measure()
    })
    observer.observe(box)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => state.tool.value,
  () => {
    const box = el.value
    const button = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box || !button || box.scrollWidth <= box.clientWidth) return
    const start = button.offsetLeft - 24
    const end = button.offsetLeft + button.offsetWidth + 24 - box.clientWidth
    if (box.scrollLeft > start) box.scrollLeft = start
    else if (box.scrollLeft < end) box.scrollLeft = end
  },
  { flush: 'post' },
)
</script>

<template>
  <div
    v-if="!ctx.readonly.value || ctx.canComment.value"
    class="dou-whiteboard-toolbar"
    data-flow-overlay
    role="toolbar"
    :aria-label="t.tools"
  >
    <div
      ref="el"
      class="dou-whiteboard-toolbar__scroll"
      :class="{ 'has-more-start': more.start, 'has-more-end': more.end }"
      @scroll.passive="measure"
    >
      <template v-for="(group, i) in groups" :key="i">
        <span v-if="i" class="dou-whiteboard-toolbar__divider" />
        <DouTooltip
          v-for="item in group"
          :key="item.tool"
          :content="t[item.tool]"
          :shortcut="whiteboardKeys[item.tool]"
          placement="bottom"
        >
          <button
            type="button"
            class="dou-whiteboard-toolbar__button"
            :class="{ 'is-locked': state.tool.value === item.tool && state.locked.value }"
            :aria-pressed="state.tool.value === item.tool"
            :aria-label="t[item.tool]"
            @click="pick(item.tool, false)"
            @dblclick="pick(item.tool, true)"
          >
            <component
              :is="item.tool === 'hand' && state.panning.value ? HandGrabIcon : item.icon"
            />
          </button>
        </DouTooltip>
      </template>
      <DouTooltip
        v-if="!ctx.readonly.value"
        :content="t.image"
        :shortcut="imageKey"
        placement="bottom"
      >
        <button
          type="button"
          class="dou-whiteboard-toolbar__button"
          :class="{ 'is-busy': state.uploading.value > 0 }"
          :aria-label="t.image"
          :aria-busy="state.uploading.value > 0 || undefined"
          @click="insertImage"
        >
          <ImageIcon />
        </button>
      </DouTooltip>
    </div>
  </div>
</template>
