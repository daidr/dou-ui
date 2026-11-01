<script setup>
import { defineNodeType, DouFlowEditor } from '@dou-ui/flow'
import { ref } from 'vue'
import PromptNode from './prompt-node.vue'

const promptNode = defineNodeType({
  type: 'prompt',
  component: PromptNode,
  ports: [{ id: 'text', kind: 'output' }],
  label: (node) => node.data.title,
})

const doc = ref({
  version: 1,
  nodes: [
    {
      id: 'prompt',
      type: 'prompt',
      x: 0,
      y: 0,
      data: { title: '提示词', text: '用三句话总结戴兜这周的读书笔记，语气轻松一些。' },
    },
    {
      id: 'llm',
      x: 320,
      y: 0,
      data: {
        label: '生成摘要',
        inputs: [{ id: 'prompt', label: '提示词' }],
        outputs: [{ id: 'text', label: '摘要' }],
      },
    },
  ],
  edges: [
    { id: 'e1', source: { node: 'prompt', port: 'text' }, target: { node: 'llm', port: 'prompt' } },
  ],
})
</script>

<template>
  <DouFlowEditor v-model="doc" :node-types="[promptNode]" fit-view style="height: 280px" />
  <DouCodeBlock :code="JSON.stringify(doc.nodes[0].data, null, 2)" lang="json" />
</template>
