<script setup>
import { DatabaseSearchIcon, MessageIcon, PlayIcon, SparkleIcon, UserIcon } from '@dou-ui/icons'
import { DouFlowControls, DouFlowEditor } from '@dou-ui/flow'
import { markRaw, ref } from 'vue'

const doc = ref({
  nodes: [
    {
      id: 'start',
      x: 0,
      y: 136,
      width: 128,
      data: { label: '收到提问', icon: markRaw(PlayIcon), outputs: [{ id: 'out' }] },
    },
    {
      id: 'search',
      x: 184,
      y: 0,
      data: {
        label: '检索笔记',
        icon: markRaw(DatabaseSearchIcon),
        status: 'finish',
        description: '在读书笔记里查找相关段落',
        inputs: [{ id: 'query', label: '问题' }],
        outputs: [{ id: 'docs', label: '笔记片段' }],
      },
    },
    {
      id: 'llm',
      x: 448,
      y: 96,
      data: {
        label: '生成回答',
        icon: markRaw(SparkleIcon),
        status: 'process',
        inputs: [
          { id: 'question', label: '问题' },
          { id: 'context', label: '参考资料' },
        ],
        outputs: [
          { id: 'answer', label: '回答' },
          { id: 'unsure', label: '没有把握' },
        ],
      },
    },
    {
      id: 'reply',
      x: 712,
      y: 86,
      data: { label: '发送回复', icon: markRaw(MessageIcon), inputs: [{ id: 'in' }] },
    },
    {
      id: 'confirm',
      x: 712,
      y: 214,
      data: { label: '请戴兜确认', icon: markRaw(UserIcon), inputs: [{ id: 'in' }] },
    },
  ],
  edges: [
    { id: 'e1', source: { node: 'start', port: 'out' }, target: { node: 'search', port: 'query' } },
    { id: 'e2', source: { node: 'start', port: 'out' }, target: { node: 'llm', port: 'question' } },
    {
      id: 'e3',
      source: { node: 'search', port: 'docs' },
      target: { node: 'llm', port: 'context' },
    },
    { id: 'e4', source: { node: 'llm', port: 'answer' }, target: { node: 'reply', port: 'in' } },
    { id: 'e5', source: { node: 'llm', port: 'unsure' }, target: { node: 'confirm', port: 'in' } },
  ],
})
</script>

<template>
  <DouFlowEditor v-model="doc" fit-view aria-label="问答流程">
    <DouFlowControls />
  </DouFlowEditor>
</template>
