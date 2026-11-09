<script setup lang="ts">
import { defineNodeType, DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { ref } from 'vue'
import PendingNode from './pending-node.vue'

const nodeTypes = [
  defineNodeType<{ text?: string }>({
    type: 'pending',
    component: PendingNode,
    ports: 'sides',
    frame: false,
    resizable: { minWidth: 96, minHeight: 48 },
    size: { width: 160, height: 64 },
    label: (node) => `待定：${node.data?.text || '待定'}`,
  }),
]
const extensions = [flowKit(), whiteboardKit()]

// 鼠标移到虚线框上看起点；从“订票”拉一条连接线到虚线框，终点才显示
const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    {
      id: 'ticket',
      type: 'shape',
      x: 0,
      y: 0,
      width: 160,
      height: 64,
      data: { shape: 'rect', text: '订票' },
    },
    {
      id: 'hotel',
      type: 'pending',
      x: 280,
      y: 0,
      width: 160,
      height: 64,
      data: { text: '住哪里还没定' },
    },
  ],
  edges: [],
})
</script>

<template>
  <DouFlowEditor
    v-model="doc"
    :node-types="nodeTypes"
    :extensions="extensions"
    fit-view
    aria-label="端口显示时机示例"
    style="height: 320px"
  />
</template>
