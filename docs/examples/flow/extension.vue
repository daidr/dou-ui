<script setup lang="ts">
import {
  DouFlowControls,
  DouFlowEditor,
  defineFlowExtension,
  flowKit,
  type FlowDocument,
} from '@dou-ui/flow'
import { ref } from 'vue'
import GroupFrames from './group-frames.vue'

let count = 1

const groups = defineFlowExtension({
  name: 'groups',
  layers: { below: [GroupFrames] },
  keymap: ({ selection, transact }) => ({
    // Puts the selected nodes into a new group.
    'mod+g': () => {
      const ids = selection.value.nodes
      if (ids.length < 2) return false
      const group = `分组 ${count++}`
      transact((tr) => {
        for (const id of ids) tr.updateData(id, { group })
      })
    },
    // Takes them out of their group.
    'mod+shift+g': () => {
      transact((tr) => {
        for (const id of selection.value.nodes) tr.updateData(id, { group: undefined })
      })
    },
  }),
  // Pasted copies start outside any group.
  transformPaste: (data: FlowDocument) => ({
    ...data,
    nodes: data.nodes.map((node) => ({ ...node, data: { ...node.data, group: undefined } })),
  }),
})

const extensions = [flowKit(), groups]

const node = (id: string, x: number, y: number, label: string, group?: string) => ({
  id,
  x,
  y,
  data: {
    label,
    group,
    inputs: id === 'a' ? [] : [{ id: 'in' }],
    outputs: id === 'd' ? [] : [{ id: 'out' }],
  },
})
const link = (from: string, to: string) => ({
  id: `${from}-${to}`,
  source: { node: from, port: 'out' },
  target: { node: to, port: 'in' },
})

const doc = ref<FlowDocument>({
  nodes: [
    node('a', 0, 72, '收到订单'),
    node('b', 240, 0, '检查库存', '准备'),
    node('c', 240, 112, '计算运费', '准备'),
    node('d', 480, 56, '安排发货'),
  ],
  edges: [link('a', 'b'), link('a', 'c'), link('b', 'd'), link('c', 'd')],
})
</script>

<template>
  <DouFlowEditor v-model="doc" :extensions="extensions" fit-view aria-label="发货流程">
    <DouFlowControls />
  </DouFlowEditor>
</template>
