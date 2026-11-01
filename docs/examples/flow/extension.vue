<script setup lang="ts">
import {
  DouFlowControls,
  DouFlowEditor,
  defineFlowExtension,
  flowKit,
  type FlowDocument,
} from '@dou-ui/flow'
import { ref } from 'vue'
import MarkRings from './mark-rings.vue'

const marks = defineFlowExtension({
  name: 'marks',
  layers: { below: [MarkRings] },
  keymap: ({ selection, doc, transact }) => ({
    // Marks the selected nodes, or clears the mark if they all have it.
    m: () => {
      const ids = selection.value.nodes
      if (!ids.length) return false
      const all = ids.every((id) => doc.value.nodes.find((n) => n.id === id)?.data?.marked)
      transact((tr) => {
        for (const id of ids) tr.updateData(id, { marked: all ? undefined : true })
      })
    },
  }),
  // Pasted copies start without the mark.
  transformPaste: (data: FlowDocument) => ({
    ...data,
    nodes: data.nodes.map((node) => ({ ...node, data: { ...node.data, marked: undefined } })),
  }),
})

const extensions = [flowKit(), marks]

const node = (id: string, x: number, y: number, label: string, marked?: boolean) => ({
  id,
  x,
  y,
  data: {
    label,
    marked,
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
  version: 1,
  nodes: [
    node('a', 0, 72, '收到订单'),
    node('b', 240, 0, '检查库存', true),
    node('c', 240, 112, '计算运费'),
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
