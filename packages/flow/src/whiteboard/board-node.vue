<script setup lang="ts">
import { ImageOffIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, toRef, useTemplateRef, watch } from 'vue'
import { DouFlowPort } from '../components/port'
import { useFlowEditor } from '../context'
import type { NodeViewProps } from '../core/node-types'
import type { Tone } from 'dou-ui'
import { fitInk, inkOutline, INK_SIZE, unpack } from './ink'
import { anchorSides, type WhiteboardShape } from './model'
import { boardState } from './state'
import { RESIZE_HANDLES, useTransformHandles, type ResizeHandle } from './transform'

type BoardData = {
  [key: string]: unknown
  text?: string
  shape?: WhiteboardShape
  tone?: Tone
  rotation?: number
  points?: number[]
  box?: [number, number]
  size?: number
  src?: string
  alt?: string
}

type Kind = 'shape' | 'sticky' | 'text' | 'ink' | 'image'

const props = defineProps<NodeViewProps<BoardData>>()
const ctx = useFlowEditor()
const state = boardState(ctx)

const KINDS: readonly Kind[] = ['sticky', 'text', 'ink', 'image']
/** What the node is: one of the shapes, a note, text, a pen stroke or an image. */
const kind = computed<Kind>(() => KINDS.find((k) => k === props.node.type) ?? 'shape')
const shape = computed<WhiteboardShape>(() => props.data.shape ?? 'rect')
const tone = computed<Tone>(
  () => props.data.tone ?? (kind.value === 'sticky' ? 'warning' : 'neutral'),
)
const writable = computed(() => ['shape', 'sticky', 'text'].includes(kind.value))

const MIN: Record<Kind, number> = { shape: 24, sticky: 64, text: 40, ink: 8, image: 24 }
const rotation = computed(() => props.data.rotation ?? 0)
const { turning, startTurn, startResize } = useTransformHandles(
  ctx,
  toRef(props, 'node'),
  rotation,
  { width: MIN[kind.value], height: MIN[kind.value] },
)
/*
 * A handle being dragged shows the node changed through the editor, so
 * `node` and `data` already are what it is dragged to: the node's own frame,
 * its ports and its edges follow along with it.
 */
const transform = computed(() => (rotation.value ? { rotate: `${rotation.value}deg` } : undefined))
/**
 * The resize handles: an image keeps its proportions, from its corners; text
 * only widens, so it has no top or bottom side; the rest has every corner
 * and side.
 */
const resizeHandles = computed(() =>
  kind.value === 'image'
    ? RESIZE_HANDLES.filter((h) => h.x && h.y)
    : kind.value === 'text'
      ? RESIZE_HANDLES.filter((h) => h.x)
      : RESIZE_HANDLES,
)
const sideHandles = computed(() => resizeHandles.value.filter((h) => !h.x || !h.y))
const cornerHandles = computed(() => resizeHandles.value.filter((h) => h.x && h.y))
/** The node's box, turned with it, for the handles drawn above every node. */
const frameStyle = computed(() => {
  const rect = ctx.getNodeRect(props.node.id) ?? { ...props.node, width: 0, height: 0 }
  return {
    // `translate`, not `transform`: it applies before `rotate`, so the box
    // turns about its own centre and its offset is not turned with it
    translate: `${rect.x}px ${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    // the corners' targets keep short of the anchors in the sides' middle
    '--dou-whiteboard-frame-width': `${rect.width}px`,
    '--dou-whiteboard-frame-height': `${rect.height}px`,
    rotate: rotation.value ? `${rotation.value}deg` : undefined,
  }
})
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const
/** The resize cursor along a handle's way out, turned with the node. */
function cursorOf(handle: ResizeHandle) {
  // text only widens, from a corner too
  if (kind.value === 'text') handle = { x: handle.x, y: 0 }
  const degrees = (Math.atan2(handle.y, handle.x) * 180) / Math.PI + rotation.value
  return CURSORS[((Math.round(degrees / 45) % 4) + 4) % 4]
}
function onResize(event: PointerEvent, handle: ResizeHandle) {
  startResize(event, handle, {
    keepRatio: kind.value === 'image',
    widthOnly: kind.value === 'text',
  })
}
/** Where a handle sits on the box: `-1` is the start, `1` the end. */
const place = (v: -1 | 0 | 1) => `${(v + 1) * 50}%`

/** Handles show on the one selected node, while the select tool is in hand. */
const handles = computed(
  () =>
    props.selected &&
    !props.readonly &&
    !editing.value &&
    state.tool.value === 'select' &&
    ctx.selection.value.nodes.length === 1,
)

/** The stroke fitted to the box shown, so stretching it keeps its thickness. */
const ink = computed(() => {
  const { points, box: inkBox } = props.data
  if (kind.value !== 'ink' || !points || !inkBox) return ''
  const size = props.data.size ?? INK_SIZE
  return inkOutline(fitInk(unpack(points), inkBox, shown.value.w, shown.value.h, size), size)
})
const erasing = computed(() => state.erasing.value.has(props.node.id))

// drawn in the node's own units, half the 1.5px stroke in from the edge
const shown = computed(() => ({ w: props.node.width ?? 160, h: props.node.height ?? 100 }))
const diamond = computed(() => {
  const { w, h } = shown.value
  const i = 1
  return `${w / 2},${i} ${w - i},${h / 2} ${w / 2},${h - i} ${i},${h / 2}`
})

// Whole lines that fit, the last one ending in an ellipsis, as an export draws them.
const textEl = useTemplateRef<HTMLElement>('textEl')
const textMetrics = ref<{ line: number; padding: number } | null>(null)
watch(
  textEl,
  (el) => {
    if (!el) return
    const s = getComputedStyle(el)
    const line = Number.parseFloat(s.lineHeight)
    if (!line) return
    const padding = Number.parseFloat(s.paddingTop) + Number.parseFloat(s.paddingBottom)
    textMetrics.value = { line, padding: padding || 0 }
  },
  { flush: 'post' },
)
const textStyle = computed(() => {
  const m = textMetrics.value
  if (!m || kind.value === 'text') return undefined
  const height = shown.value.h
  return { '-webkit-line-clamp': Math.max(1, Math.floor((height - m.padding + 0.5) / m.line)) }
})

// An image that can't be loaded: a plain box with a sign, as an export draws it.
const broken = ref(false)
watch(
  () => props.data.src,
  () => (broken.value = false),
)

const editing = computed(() => state.editing.value === props.node.id)
const draft = ref('')
const field = useTemplateRef<HTMLTextAreaElement>('field')

watch(
  editing,
  (on) => {
    if (!on) return
    draft.value = props.data.text ?? ''
    void nextTick(() => {
      fit()
      field.value?.focus()
      field.value?.select()
    })
  },
  { immediate: true },
)

// browsers without `field-sizing` grow the field by hand
function fit() {
  const el = field.value
  if (!el || CSS.supports?.('field-sizing', 'content')) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
watch(draft, () => void nextTick(fit))

function edit() {
  if (props.readonly || !writable.value) return
  state.editing.value = props.node.id
}

function finish() {
  if (!editing.value) return
  state.editing.value = null
  const text = draft.value.replace(/\s+$/, '')
  // text with nothing written in it is nothing at all
  if (!text && kind.value === 'text') ctx.transact((tr) => tr.removeNode(props.node.id))
  else if (text !== (props.data.text ?? '')) props.updateData({ text: text || undefined })
  // back to the canvas, so the keys go on working
  ctx.root.value?.focus({ preventScroll: true })
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  // Escape, or mod+Enter, puts the text down; Enter is a new line
  if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
    event.preventDefault()
    event.stopPropagation()
    finish()
  }
}
</script>

<template>
  <div
    class="dou-whiteboard-node"
    :class="[
      `is-${kind}`,
      kind === 'shape' && `is-${shape}`,
      `is-${tone}`,
      {
        'is-editing': editing,
        'is-turned': !!rotation,
        'is-turning': turning !== null,
        'is-selected': selected,
        'is-erasing': erasing,
      },
    ]"
    :style="transform"
    @dblclick.stop="edit"
  >
    <svg
      v-if="kind === 'shape'"
      class="dou-whiteboard-node__shape"
      :viewBox="`0 0 ${shown.w} ${shown.h}`"
      aria-hidden="true"
    >
      <rect
        v-if="shape === 'rect'"
        x="0.75"
        y="0.75"
        :width="Math.max(0, shown.w - 1.5)"
        :height="Math.max(0, shown.h - 1.5)"
        rx="8"
      />
      <ellipse
        v-else-if="shape === 'ellipse'"
        :cx="shown.w / 2"
        :cy="shown.h / 2"
        :rx="Math.max(0, shown.w / 2 - 0.75)"
        :ry="Math.max(0, shown.h / 2 - 0.75)"
      />
      <polygon v-else :points="diamond" />
    </svg>
    <svg
      v-else-if="kind === 'ink' && data.box"
      class="dou-whiteboard-node__ink"
      :viewBox="`0 0 ${shown.w} ${shown.h}`"
      aria-hidden="true"
    >
      <path class="dou-whiteboard-node__ink-hit" :d="ink" />
      <path :d="ink" />
    </svg>
    <div
      v-else-if="kind === 'image' && broken"
      class="dou-whiteboard-node__image is-broken"
      role="img"
      :aria-label="data.alt || undefined"
    >
      <ImageOffIcon />
    </div>
    <img
      v-else-if="kind === 'image'"
      class="dou-whiteboard-node__image"
      :src="data.src"
      :alt="data.alt ?? ''"
      draggable="false"
      @error="broken = true"
    />
    <textarea
      v-if="editing"
      ref="field"
      v-model="draft"
      class="dou-whiteboard-node__text dou-whiteboard-node__field"
      :aria-label="ctx.messages.value.board.editText"
      @keydown="onKeydown"
      @blur="finish"
      @pointerdown.stop
    />
    <div
      v-else-if="writable"
      ref="textEl"
      class="dou-whiteboard-node__text"
      :style="textStyle"
      v-text="data.text"
    />
    <div v-if="kind !== 'ink'" class="dou-whiteboard-node__anchors">
      <template v-for="side in anchorSides" :key="side">
        <DouFlowPort :id="`${side}-in`" class="dou-whiteboard-node__anchor" />
        <DouFlowPort :id="side" class="dou-whiteboard-node__anchor" />
      </template>
    </div>
    <template v-if="handles">
      <!-- the sides stay on the node, under its anchors; the turn and the
           corners go above every node, so a neighbour never covers them -->
      <span
        v-for="handle in sideHandles"
        :key="`${handle.x},${handle.y}`"
        :class="['dou-whiteboard-node__side', handle.x ? 'is-x' : 'is-y']"
        :style="{ left: place(handle.x), top: place(handle.y), cursor: cursorOf(handle) }"
        :data-handle="`${handle.x},${handle.y}`"
        data-dou-nodrag
        aria-hidden="true"
        @pointerdown="onResize($event, handle)"
      />
      <Teleport :to="state.handles.value" :disabled="!state.handles.value">
        <div class="dou-whiteboard-node__frame" :style="frameStyle" aria-hidden="true">
          <!-- data-flow-overlay on its target: the selection's toolbar keeps
               clear of where a finger can take it, when it floats below the
               node or the node is turned upside down -->
          <span class="dou-whiteboard-node__turn" data-dou-nodrag @pointerdown="startTurn">
            <span class="dou-whiteboard-node__target" data-flow-overlay />
          </span>
          <span
            v-for="handle in cornerHandles"
            :key="`${handle.x},${handle.y}`"
            :class="[
              'dou-whiteboard-node__corner',
              handle.x < 0 ? 'is-left' : 'is-right',
              handle.y < 0 ? 'is-top' : 'is-bottom',
            ]"
            :style="{ left: place(handle.x), top: place(handle.y), cursor: cursorOf(handle) }"
            :data-handle="`${handle.x},${handle.y}`"
            data-dou-nodrag
            @pointerdown="onResize($event, handle)"
          />
        </div>
      </Teleport>
    </template>
  </div>
</template>
