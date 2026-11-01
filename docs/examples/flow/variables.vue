<script setup>
import { defineNodeType, DouFlowEditor } from '@dou-ui/flow'
import { computed, ref } from 'vue'
import VariableNode from './variable-node.vue'
import { variables } from './variables'

const portTypes = {
  number: { label: '数字', shape: 'diamond' },
  text: { label: '文字' },
}

// 端口的类型由节点里选中的变量决定
const variableNode = defineNodeType({
  type: 'variable',
  component: VariableNode,
  ports: (node) => [
    {
      id: 'value',
      kind: node.data.mode === 'get' ? 'output' : 'input',
      label: variables[node.data.name].label,
      dataType: variables[node.data.name].type,
    },
  ],
  label: (node) =>
    `${node.data.mode === 'get' ? '读取' : '设置'}${variables[node.data.name].label}`,
})

const editor = ref()
const doc = ref({
  version: 1,
  nodes: [
    { id: 'get', type: 'variable', x: 0, y: 0, data: { mode: 'get', name: 'count' } },
    {
      id: 'add',
      x: 256,
      y: 0,
      data: {
        label: '加一',
        inputs: [{ id: 'in', label: '数字', dataType: 'number' }],
        outputs: [{ id: 'out', label: '数字', dataType: 'number' }],
      },
    },
    { id: 'set', type: 'variable', x: 528, y: 0, data: { mode: 'set', name: 'count' } },
  ],
  edges: [
    { id: 'e1', source: { node: 'get', port: 'value' }, target: { node: 'add', port: 'in' } },
    { id: 'e2', source: { node: 'add', port: 'out' }, target: { node: 'set', port: 'value' } },
  ],
})
const stale = computed(() => (doc.value && editor.value ? editor.value.staleEdges.length : 0))
</script>

<template>
  <DouFlowEditor
    ref="editor"
    v-model="doc"
    :node-types="[variableNode]"
    :port-types="portTypes"
    fit-view
    style="height: 240px"
  />
  <DouSpace align="center">
    <DouButton variant="outline" size="sm" :disabled="!stale" @click="editor.removeStaleEdges()"
      >删除对不上的连线</DouButton
    >
    <DouText v-if="stale" tone="danger" size="sm">{{ stale }} 条连线的类型对不上了</DouText>
    <DouText v-else variant="secondary" size="sm">把任意一个节点的变量换成“活动标题”试试</DouText>
  </DouSpace>
</template>
