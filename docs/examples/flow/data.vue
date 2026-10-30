<script setup>
import { DouFlowEditor } from '@dou-ui/flow'
import { computed, ref } from 'vue'

const doc = ref({
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: '收集素材', outputs: [{ id: 'out' }] } },
    { id: 'b', x: 288, y: 0, data: { label: '写初稿', inputs: [{ id: 'in' }] } },
  ],
  edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
})
const selection = ref({ nodes: [], edges: [] })
// One line per node, so the positions are easy to follow while dragging.
const json = computed(() => {
  const nodes = doc.value.nodes.map(({ id, x, y }) => `    { "id": "${id}", "x": ${x}, "y": ${y} }`)
  return `{
  "nodes": [
${nodes.join(',\n')}
  ],
  "selection": ${JSON.stringify(selection.value)}
}`
})
</script>

<template>
  <DouFlowEditor v-model="doc" v-model:selection="selection" fit-view style="height: 240px" />
  <DouCodeBlock :code="json" lang="json" />
</template>
