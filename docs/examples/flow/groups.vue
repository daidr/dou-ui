<script setup lang="ts">
import { CalendarIcon, FileTextIcon, MessageIcon, SendIcon, UserIcon } from '@dou-ui/icons'
import { DouFlowControls, DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import { markRaw, ref } from 'vue'

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    { id: 'collect', type: 'group', x: 0, y: 0, width: 216, height: 196, data: { label: '收集' } },
    {
      id: 'calendar',
      parent: 'collect',
      x: 24,
      y: 56,
      width: 168,
      data: { label: '本周日程', icon: markRaw(CalendarIcon), outputs: [{ id: 'out' }] },
    },
    {
      id: 'chat',
      parent: 'collect',
      x: 24,
      y: 126,
      width: 168,
      data: { label: '群聊记录', icon: markRaw(MessageIcon), outputs: [{ id: 'out' }] },
    },
    {
      id: 'draft',
      x: 280,
      y: 88,
      width: 168,
      data: {
        label: '起草周报',
        icon: markRaw(FileTextIcon),
        inputs: [{ id: 'in' }],
        outputs: [{ id: 'out' }],
      },
    },
    { id: 'send', type: 'group', x: 512, y: 32, width: 424, height: 126, data: { label: '发出' } },
    {
      id: 'review',
      parent: 'send',
      x: 536,
      y: 88,
      width: 168,
      data: {
        label: '请戴兜过目',
        icon: markRaw(UserIcon),
        inputs: [{ id: 'in' }],
        outputs: [{ id: 'out' }],
      },
    },
    {
      id: 'mail',
      parent: 'send',
      x: 744,
      y: 88,
      width: 168,
      data: { label: '发到上海团队', icon: markRaw(SendIcon), inputs: [{ id: 'in' }] },
    },
  ],
  edges: [
    { id: 'e1', source: { node: 'calendar', port: 'out' }, target: { node: 'draft', port: 'in' } },
    { id: 'e2', source: { node: 'chat', port: 'out' }, target: { node: 'draft', port: 'in' } },
    { id: 'e3', source: { node: 'draft', port: 'out' }, target: { node: 'review', port: 'in' } },
    { id: 'e4', source: { node: 'review', port: 'out' }, target: { node: 'mail', port: 'in' } },
  ],
})
</script>

<template>
  <DouFlowEditor v-model="doc" fit-view aria-label="周报流程">
    <DouFlowControls />
  </DouFlowEditor>
</template>
