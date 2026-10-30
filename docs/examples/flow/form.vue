<script setup>
import { defineNodeType, DouFlowEditor } from '@dou-ui/flow'
import { computed, ref } from 'vue'
import FormNode from './form-node.vue'

const formNode = defineNodeType({
  type: 'answer',
  component: FormNode,
  ports: [
    { id: 'in', kind: 'input' },
    { id: 'out', kind: 'output' },
  ],
  label: () => '生成回答',
})

const doc = ref({
  nodes: [
    { id: 'ask', x: 0, y: 0, data: { label: '收到提问', outputs: [{ id: 'out' }] } },
    {
      id: 'answer',
      type: 'answer',
      x: 272,
      y: 0,
      data: { model: 'balanced', prompt: '回答时引用戴兜的笔记', stream: true },
    },
    { id: 'reply', x: 592, y: 0, data: { label: '发送回复', inputs: [{ id: 'in' }] } },
  ],
  edges: [
    { id: 'e1', source: { node: 'ask', port: 'out' }, target: { node: 'answer', port: 'in' } },
    { id: 'e2', source: { node: 'answer', port: 'out' }, target: { node: 'reply', port: 'in' } },
  ],
})
const json = computed(() => JSON.stringify(doc.value.nodes[1].data, null, 2))
</script>

<template>
  <DouFlowEditor v-model="doc" :node-types="[formNode]" fit-view style="height: 320px" />
  <DouCodeBlock :code="json" lang="json" />
</template>
