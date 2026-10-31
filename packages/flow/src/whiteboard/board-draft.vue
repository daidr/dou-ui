<script setup lang="ts">
import { computed } from 'vue'
import { useFlowEditor } from '../context'
import { inkOutline } from './ink'
import { boardState } from './state'

// What a tool is drawing: the box of a shape, note or text, the pen's
// stroke, or the eraser's reach.
const ctx = useFlowEditor()
const state = boardState(ctx)
const ink = computed(() => (state.ink.value ? inkOutline(state.ink.value) : ''))
const eraserRadius = computed(() => 8 / ctx.viewport.value.zoom)
</script>

<template>
  <div
    v-if="state.draft.value"
    class="dou-whiteboard-draft"
    :class="`is-${state.draft.value.tool}`"
    :style="{
      transform: `translate(${state.draft.value.x}px, ${state.draft.value.y}px)`,
      width: `${state.draft.value.width}px`,
      height: `${state.draft.value.height}px`,
    }"
    aria-hidden="true"
  />
  <svg v-if="ink || state.eraser.value" class="dou-whiteboard-strokes" aria-hidden="true">
    <path v-if="ink" class="dou-whiteboard-strokes__ink" :d="ink" />
    <circle
      v-if="state.eraser.value"
      class="dou-whiteboard-strokes__eraser"
      :cx="state.eraser.value.x"
      :cy="state.eraser.value.y"
      :r="eraserRadius"
    />
  </svg>
</template>
