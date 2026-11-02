<script setup lang="ts">
import { DouGantt, spanOf, type GanttDocument } from '@dou-ui/gantt'
import { DouButton, DouSpace } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const DAY = 24 * 60

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'spec', title: '写需求文档', start: day(-3), end: day(-1), progress: 1 },
    { id: 'ui', title: '设计稿', start: day(0), end: day(3), progress: 0.4 },
    { id: 'fe', title: '前端开发', start: day(4), end: day(9) },
    { id: 'qa', title: '测试', start: day(10), end: day(12) },
  ],
  links: [
    { id: 'l1', from: 'spec', to: 'ui' },
    { id: 'l2', from: 'ui', to: 'fe' },
    { id: 'l3', from: 'fe', to: 'qa' },
  ],
})
const gantt = useTemplateRef<InstanceType<typeof DouGantt>>('gantt')

// 没开始的任务都推迟一天，整个修改撤销一次即可恢复
function postpone() {
  gantt.value?.transact((tr) => {
    for (const task of tr.doc.tasks) {
      const span = spanOf(task)
      if (!span || task.progress) continue
      tr.setSpan(task.id, span.start + DAY, span.end + DAY)
    }
  })
}
</script>

<template>
  <div class="gantt-demo">
    <DouSpace>
      <DouButton size="sm" @click="postpone">没开始的任务推迟一天</DouButton>
      <DouButton size="sm" variant="ghost" :disabled="!gantt?.canUndo" @click="gantt?.undo()">
        撤销
      </DouButton>
    </DouSpace>
    <DouGantt ref="gantt" v-model="plan" />
  </div>
</template>

<style scoped>
.gantt-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--dou-space-md);
}
</style>
