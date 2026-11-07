<script setup lang="ts">
import { inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouSplitter } from '../splitter'
import { dockKey } from './context'
import type { DockNode } from './layout'

defineOptions({ name: 'DouDockNode' })

const props = defineProps<{ node: DockNode }>()
const dock = inject(dockKey)!
const ns = useNamespace('dock')

function setCell(el: unknown) {
  if (props.node.type === 'group') dock.setCell(props.node.id, el)
}
</script>

<template>
  <DouSplitter
    v-if="node.type === 'split'"
    :class="ns.e('split')"
    :model-value="node.size ?? 50"
    :direction="node.direction"
    :min="dock.min(node.direction)"
    :min-end="dock.min(node.direction)"
    @update:model-value="dock.resize(node, $event)"
  >
    <template #start><DouDockNode :node="node.start" /></template>
    <template #end><DouDockNode :node="node.end" /></template>
  </DouSplitter>
  <!-- The group is rendered by the dock and moved in here, so its content
   stays as it is while the layout around it changes. -->
  <div v-else :ref="setCell" :class="ns.e('cell')" />
</template>
