<script setup>
import { DouFlowEditor } from '@dou-ui/flow'
import { ref } from 'vue'

const table = (id, label = '表格') => ({ id, label, dataType: 'table' })

const doc = ref({
  nodes: [
    { id: 'read', x: 0, y: 40, data: { label: '读取账单', outputs: [table('rows')] } },
    {
      id: 'month',
      x: 272,
      y: 40,
      data: { label: '只留本月', inputs: [table('in')], outputs: [table('out')] },
    },
    {
      id: 'sum',
      x: 544,
      y: 0,
      data: {
        label: '按类别求和',
        inputs: [table('in')],
        outputs: [{ id: 'total', label: '数字', dataType: 'number' }],
      },
    },
    { id: 'chart', x: 544, y: 120, data: { label: '画柱状图', inputs: [table('data')] } },
    {
      id: 'report',
      x: 816,
      y: 0,
      data: { label: '写进周报', inputs: [{ id: 'text', label: '文字', dataType: 'text' }] },
    },
  ],
  edges: [
    { id: 'e1', source: { node: 'read', port: 'rows' }, target: { node: 'month', port: 'in' } },
    { id: 'e2', source: { node: 'month', port: 'out' }, target: { node: 'sum', port: 'in' } },
  ],
})
</script>

<template>
  <DouFlowEditor v-model="doc" fit-view style="height: 300px" />
</template>
