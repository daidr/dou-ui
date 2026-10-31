<script setup lang="ts">
import {
  FocusIcon,
  HierarchyHorizontalIcon,
  RedoIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@dou-ui/icons'
import { DouTooltip } from 'dou-ui'
import { computed } from 'vue'
import { useFlowEditor, type FlowControlsProps } from '../context'
import { format } from '../locale'

defineOptions({ name: 'DouFlowControls' })

const props = withDefaults(defineProps<FlowControlsProps>(), {
  placement: 'bottom-left',
  history: true,
  tidy: true,
})

const flow = useFlowEditor()
const { messages } = flow
const zoom = computed(() => flow.viewport.value.zoom)
const percent = computed(() => Math.round(zoom.value * 100))
const showHistory = computed(() => props.history && !flow.readonly.value)
/** Tips open away from the edge the controls sit on. */
const tipPlacement = computed(() => (props.placement.startsWith('top') ? 'bottom' : 'top'))
</script>

<template>
  <div
    class="dou-flow-controls"
    data-flow-overlay
    :class="`is-${placement}`"
    role="toolbar"
    :aria-label="messages.controls"
  >
    <template v-if="showHistory">
      <DouTooltip :content="messages.undo" shortcut="mod+z" :placement="tipPlacement">
        <button
          type="button"
          class="dou-flow-controls__button"
          :disabled="!flow.canUndo.value"
          :aria-label="messages.undo"
          @click="flow.undo()"
        >
          <UndoIcon />
        </button>
      </DouTooltip>
      <DouTooltip :content="messages.redo" shortcut="mod+shift+z" :placement="tipPlacement">
        <button
          type="button"
          class="dou-flow-controls__button"
          :disabled="!flow.canRedo.value"
          :aria-label="messages.redo"
          @click="flow.redo()"
        >
          <RedoIcon />
        </button>
      </DouTooltip>
      <span class="dou-flow-controls__divider" />
    </template>
    <DouTooltip :content="messages.zoomOut" shortcut="mod+-" :placement="tipPlacement">
      <button
        type="button"
        class="dou-flow-controls__button"
        :disabled="zoom <= flow.minZoom.value"
        :aria-label="messages.zoomOut"
        @click="flow.zoomOut()"
      >
        <ZoomOutIcon />
      </button>
    </DouTooltip>
    <DouTooltip :content="messages.zoomReset" shortcut="mod+0" :placement="tipPlacement">
      <button
        type="button"
        class="dou-flow-controls__button dou-flow-controls__zoom"
        :aria-label="format(messages.zoomLevel, { value: percent })"
        @click="flow.zoomTo(1)"
      >
        {{ percent }}%
      </button>
    </DouTooltip>
    <DouTooltip :content="messages.zoomIn" shortcut="mod+=" :placement="tipPlacement">
      <button
        type="button"
        class="dou-flow-controls__button"
        :disabled="zoom >= flow.maxZoom.value"
        :aria-label="messages.zoomIn"
        @click="flow.zoomIn()"
      >
        <ZoomInIcon />
      </button>
    </DouTooltip>
    <DouTooltip :content="messages.fit" :placement="tipPlacement">
      <button
        type="button"
        class="dou-flow-controls__button"
        :aria-label="messages.fit"
        @click="flow.fit()"
      >
        <FocusIcon />
      </button>
    </DouTooltip>
    <DouTooltip
      v-if="tidy && !flow.readonly.value"
      :content="messages.tidy"
      :placement="tipPlacement"
    >
      <button
        type="button"
        class="dou-flow-controls__button"
        :aria-label="messages.tidy"
        @click="flow.tidy()"
      >
        <HierarchyHorizontalIcon />
      </button>
    </DouTooltip>
  </div>
</template>
