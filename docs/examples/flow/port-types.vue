<script setup>
import { DouFlowEditor } from '@dou-ui/flow'
import { ref } from 'vue'

const portTypes = {
  exec: { label: '执行', shape: 'triangle', edgeWidth: 2 },
  table: { label: '表格', shape: 'square' },
  number: { label: '数字', shape: 'diamond' },
  // 文字端口也接受数字
  text: { label: '文字', accepts: ['number'] },
}

const run = (kind, id = kind === 'input' ? 'run' : 'then') => ({
  id,
  label: kind === 'input' ? '执行' : '然后',
  dataType: 'exec',
})

const doc = ref({
  nodes: [
    { id: 'start', x: 0, y: 0, data: { label: '每周一 9:00', outputs: [run('output')] } },
    {
      id: 'read',
      x: 272,
      y: 0,
      data: {
        label: '读取账单',
        inputs: [run('input')],
        outputs: [run('output'), { id: 'rows', label: '表格', dataType: 'table' }],
      },
    },
    {
      id: 'sum',
      x: 544,
      y: 0,
      data: {
        label: '求和',
        inputs: [run('input'), { id: 'in', label: '表格', dataType: 'table' }],
        outputs: [run('output'), { id: 'total', label: '数字', dataType: 'number' }],
      },
    },
    {
      id: 'send',
      x: 816,
      y: 0,
      data: {
        label: '发给戴兜',
        inputs: [run('input'), { id: 'text', label: '文字', dataType: 'text' }],
      },
    },
  ],
  edges: [
    { id: 'e1', source: { node: 'start', port: 'then' }, target: { node: 'read', port: 'run' } },
    { id: 'e2', source: { node: 'read', port: 'then' }, target: { node: 'sum', port: 'run' } },
    { id: 'e3', source: { node: 'read', port: 'rows' }, target: { node: 'sum', port: 'in' } },
  ],
})
</script>

<template>
  <DouFlowEditor v-model="doc" :port-types="portTypes" acyclic fit-view style="height: 280px" />
</template>
