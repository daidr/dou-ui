<script setup lang="ts">
import { DouFlowControls, DouFlowEditor, DouFlowMinimap, type FlowDocument } from '@dou-ui/flow'
import { shallowRef } from 'vue'

const steps = ['收集', '清洗', '校对', '归档', '汇总']

// 500 nodes in 20 rows; each passes on to the next, and some skip a row.
function build(): FlowDocument {
  const columns = 25
  const nodes = Array.from({ length: 500 }, (_, i) => ({
    id: `n${i}`,
    x: (i % columns) * 272,
    y: Math.floor(i / columns) * 112,
    data: {
      label: `${steps[i % steps.length]} ${i + 1}`,
      inputs: [{ id: 'in' }],
      outputs: [{ id: 'out' }],
    },
  }))
  const edges = []
  for (let i = 0; i < nodes.length; i++) {
    if ((i + 1) % columns)
      edges.push({
        id: `a${i}`,
        source: { node: `n${i}`, port: 'out' },
        target: { node: `n${i + 1}`, port: 'in' },
      })
    if (i % 4 === 0 && i + columns + 1 < nodes.length && (i + 1) % columns)
      edges.push({
        id: `b${i}`,
        source: { node: `n${i}`, port: 'out' },
        target: { node: `n${i + columns + 1}`, port: 'in' },
      })
  }
  return { nodes, edges }
}

const doc = shallowRef(build())
</script>

<template>
  <DouFlowEditor v-model="doc" aria-label="500 个节点">
    <DouFlowControls />
    <DouFlowMinimap />
  </DouFlowEditor>
</template>
