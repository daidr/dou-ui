<script setup lang="ts">
import { useFlowEditor } from '../context'
import { boardState } from './state'

// The box being drawn with a shape, note or text tool.
const state = boardState(useFlowEditor())
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
</template>
