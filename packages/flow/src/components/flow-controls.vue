<script setup lang="ts">
import { FocusIcon, RedoIcon, UndoIcon, ZoomInIcon, ZoomOutIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useFlowEditor } from '../context'
import { format } from '../locale'

defineOptions({ name: 'DouFlowControls' })

const props = withDefaults(
  defineProps<{
    /** Corner of the editor to sit in. */
    placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    /** Show undo and redo. */
    history?: boolean
  }>(),
  { placement: 'bottom-left', history: true },
)

const flow = useFlowEditor()
const { messages } = flow
const zoom = computed(() => flow.viewport.value.zoom)
const percent = computed(() => Math.round(zoom.value * 100))
const showHistory = computed(() => props.history && !flow.readonly.value)
</script>

<template>
  <div
    class="dou-flow-controls"
    :class="`is-${placement}`"
    role="toolbar"
    :aria-label="messages.controls"
  >
    <template v-if="showHistory">
      <button
        type="button"
        class="dou-flow-controls__button"
        :disabled="!flow.canUndo.value"
        :aria-label="messages.undo"
        :title="messages.undo"
        @click="flow.undo()"
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        class="dou-flow-controls__button"
        :disabled="!flow.canRedo.value"
        :aria-label="messages.redo"
        :title="messages.redo"
        @click="flow.redo()"
      >
        <RedoIcon />
      </button>
      <span class="dou-flow-controls__divider" />
    </template>
    <button
      type="button"
      class="dou-flow-controls__button"
      :disabled="zoom <= flow.minZoom.value"
      :aria-label="messages.zoomOut"
      :title="messages.zoomOut"
      @click="flow.zoomOut()"
    >
      <ZoomOutIcon />
    </button>
    <button
      type="button"
      class="dou-flow-controls__button dou-flow-controls__zoom"
      :aria-label="format(messages.zoomLevel, { value: percent })"
      @click="flow.zoomTo(1)"
    >
      {{ percent }}%
    </button>
    <button
      type="button"
      class="dou-flow-controls__button"
      :disabled="zoom >= flow.maxZoom.value"
      :aria-label="messages.zoomIn"
      :title="messages.zoomIn"
      @click="flow.zoomIn()"
    >
      <ZoomInIcon />
    </button>
    <button
      type="button"
      class="dou-flow-controls__button"
      :aria-label="messages.fit"
      :title="messages.fit"
      @click="flow.fit()"
    >
      <FocusIcon />
    </button>
  </div>
</template>
