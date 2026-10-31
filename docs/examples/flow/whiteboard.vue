<script setup lang="ts">
import { DouFlowControls, DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { ref } from 'vue'

const extensions = [flowKit(), whiteboardKit()]

const doc = ref<FlowDocument>({
  nodes: [
    {
      id: 'goal',
      type: 'shape',
      x: 0,
      y: 40,
      width: 180,
      height: 96,
      data: { shape: 'ellipse', text: '周末去上海看展' },
    },
    {
      id: 'when',
      type: 'shape',
      x: 280,
      y: 28,
      width: 160,
      height: 120,
      data: { shape: 'diamond', text: '周六有空？' },
    },
    {
      id: 'book',
      type: 'shape',
      x: 540,
      y: 40,
      width: 160,
      height: 96,
      data: { shape: 'rect', text: '订周六上午的票', tone: 'success' },
    },
    {
      id: 'idea',
      type: 'sticky',
      x: 300,
      y: 220,
      width: 160,
      height: 160,
      data: { text: '顺路吃生煎' },
    },
    { id: 'note', type: 'text', x: 540, y: 200, width: 200, data: { text: '戴兜：记得带学生证' } },
    {
      // a pen stroke under the booking
      id: 'underline',
      type: 'ink',
      x: 544,
      y: 146,
      width: 152,
      height: 15,
      data: {
        box: [152, 15],
        points: [
          4, 6, 0.5, 16, 8.5, 0.5, 28, 9.5, 0.5, 40, 8.8, 0.5, 52, 6.9, 0.5, 64, 4.9, 0.5, 76, 4.2,
          0.5, 88, 5.2, 0.5, 100, 7.5, 0.5, 112, 9.8, 0.5, 124, 10.9, 0.5, 136, 10.2, 0.5, 148, 8.2,
          0.5,
        ],
      },
    },
  ],
  edges: [
    {
      id: 'e1',
      type: 'connector',
      source: { node: 'goal', port: 'right' },
      target: { node: 'when', port: 'left-in' },
    },
    {
      id: 'e2',
      type: 'connector',
      source: { node: 'when', port: 'right' },
      target: { node: 'book', port: 'left-in' },
      label: '有空',
    },
  ],
})
</script>

<template>
  <DouFlowEditor
    v-model="doc"
    :extensions="extensions"
    fit-view
    aria-label="周末计划白板"
    style="height: 480px"
  >
    <DouFlowControls />
  </DouFlowEditor>
</template>
