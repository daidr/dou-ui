<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import DouFlowPort from '../components/flow-port.vue'
import { useFlowEditor } from '../context'
import type { NodeViewProps } from '../core/node-types'
import { anchorSides, type WhiteboardColor, type WhiteboardShape } from './model'
import { boardState } from './state'

type BoardData = {
  [key: string]: unknown
  text?: string
  shape?: WhiteboardShape
  color?: WhiteboardColor
}

const props = defineProps<NodeViewProps<BoardData>>()
const ctx = useFlowEditor()
const state = boardState(ctx)

/** What the node is: one of the shapes, a sticky note or plain text. */
const kind = computed(() =>
  props.node.type === 'sticky' ? 'sticky' : props.node.type === 'text' ? 'text' : 'shape',
)
const shape = computed<WhiteboardShape>(() => props.data.shape ?? 'rect')
const color = computed<WhiteboardColor>(
  () => props.data.color ?? (kind.value === 'sticky' ? 'warning' : 'neutral'),
)

// drawn in the node's own units, half the 1.5px stroke in from the edge
const box = computed(() => ({ w: props.node.width ?? 160, h: props.node.height ?? 100 }))
const diamond = computed(() => {
  const { w, h } = box.value
  const i = 1
  return `${w / 2},${i} ${w - i},${h / 2} ${w / 2},${h - i} ${i},${h / 2}`
})

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
  if (props.readonly) return
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
      `is-${color}`,
      { 'is-editing': editing },
    ]"
    @dblclick.stop="edit"
  >
    <svg
      v-if="kind === 'shape'"
      class="dou-whiteboard-node__shape"
      :viewBox="`0 0 ${box.w} ${box.h}`"
      aria-hidden="true"
    >
      <rect
        v-if="shape === 'rect'"
        x="0.75"
        y="0.75"
        :width="Math.max(0, box.w - 1.5)"
        :height="Math.max(0, box.h - 1.5)"
        rx="8"
      />
      <ellipse
        v-else-if="shape === 'ellipse'"
        :cx="box.w / 2"
        :cy="box.h / 2"
        :rx="Math.max(0, box.w / 2 - 0.75)"
        :ry="Math.max(0, box.h / 2 - 0.75)"
      />
      <polygon v-else :points="diamond" />
    </svg>
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
    <div v-else class="dou-whiteboard-node__text">{{ data.text }}</div>
    <div v-if="kind !== 'text'" class="dou-whiteboard-node__anchors">
      <template v-for="side in anchorSides" :key="side">
        <DouFlowPort :id="`${side}-in`" class="dou-whiteboard-node__anchor" />
        <DouFlowPort :id="side" class="dou-whiteboard-node__anchor" />
      </template>
    </div>
  </div>
</template>
