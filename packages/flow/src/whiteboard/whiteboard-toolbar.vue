<script setup lang="ts">
import {
  BrushIcon,
  CircleIcon,
  CursorIcon,
  DiamondIcon,
  EraserIcon,
  HandGrabIcon,
  HandIcon,
  ImageIcon,
  SquareIcon,
  StickyNoteIcon,
  TypeIcon,
} from '@dou-ui/icons'
import { computed, type Component } from 'vue'
import { useFlowEditor } from '../context'
import { format } from '../locale'
import { pickImages } from './image'
import { imageKey, whiteboardKeys, type WhiteboardTool } from './model'
import { boardState } from './state'

defineOptions({ name: 'DouWhiteboardToolbar' })

const ctx = useFlowEditor()
const state = boardState(ctx)
const t = computed(() => ctx.messages.value.board)

const groups: { tool: WhiteboardTool; icon: Component }[][] = [
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
    { tool: 'pen', icon: BrushIcon },
    { tool: 'eraser', icon: EraserIcon },
  ],
]

/** Tools that go back to select after one use, unless kept with a double click. */
const once = new Set<WhiteboardTool>(['rect', 'ellipse', 'diamond', 'sticky', 'text'])

const titleOf = (tool: WhiteboardTool) =>
  format(t.value.key, { tool: t.value[tool], key: whiteboardKeys[tool].toUpperCase() })

// A click picks the tool for one use; a double click keeps it. Focus goes
// back to the canvas, where the tool is used and its keys work.
function pick(tool: WhiteboardTool, keep: boolean) {
  state.tool.value = tool
  state.locked.value = keep && once.has(tool)
  ctx.root.value?.focus({ preventScroll: true })
}

const imageTitle = computed(() =>
  format(t.value.key, { tool: t.value.image, key: imageKey.toUpperCase() }),
)
function insertImage() {
  pickImages(ctx)
}
</script>

<template>
  <div
    v-if="!ctx.readonly.value"
    class="dou-whiteboard-toolbar"
    role="toolbar"
    :aria-label="t.tools"
  >
    <template v-for="(group, i) in groups" :key="i">
      <span v-if="i" class="dou-whiteboard-toolbar__divider" />
      <button
        v-for="item in group"
        :key="item.tool"
        type="button"
        class="dou-whiteboard-toolbar__button"
        :class="{ 'is-locked': state.tool.value === item.tool && state.locked.value }"
        :aria-pressed="state.tool.value === item.tool"
        :aria-label="titleOf(item.tool)"
        :title="titleOf(item.tool)"
        @click="pick(item.tool, false)"
        @dblclick="pick(item.tool, true)"
      >
        <component :is="item.tool === 'hand' && state.panning.value ? HandGrabIcon : item.icon" />
      </button>
    </template>
    <button
      type="button"
      class="dou-whiteboard-toolbar__button"
      :class="{ 'is-busy': state.uploading.value > 0 }"
      :aria-label="imageTitle"
      :aria-busy="state.uploading.value > 0 || undefined"
      :title="imageTitle"
      @click="insertImage"
    >
      <ImageIcon />
    </button>
  </div>
</template>
