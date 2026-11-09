<script setup lang="ts">
import type { FlowPortVisible } from '../core/model'
import PortView from './port-view.vue'

defineOptions({ name: 'DouFlowPort' })

defineProps<{
  /** The id of one of the node's ports. */
  id: string
  /**
   * When the port shows: `always`; `hover`, on a hovered or selected node,
   * or one with the keyboard focus in it (a field being typed in);
   * or `connecting`, only while an edge is drawn. Never shown in a
   * readonly editor. Defaults to the port's own `visible`, else `always`.
   */
  visible?: FlowPortVisible
}>()
</script>

<template>
  <PortView :id="id" :visible="visible" />
</template>
