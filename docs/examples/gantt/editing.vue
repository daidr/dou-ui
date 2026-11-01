<script setup lang="ts">
import { DouGantt, type GanttDocument, type GanttExpose, type GanttLink, type GanttTask } from '@dou-ui/gantt'
import { RedoIcon, UndoIcon } from '@dou-ui/icons'
import { DouButton, DouSpace, DouSwitch, DouText } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { day } from './dates'

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'plan', title: '迭代 12' },
    { id: 'spec', parent: 'plan', title: '写需求文档', start: day(-4), end: day(-2), progress: 1 },
    { id: 'ui', parent: 'plan', title: '设计稿', start: day(-1), end: day(3), progress: 0.4 },
    { id: 'fe', parent: 'plan', title: '前端开发', start: day(4), end: day(10) },
    { id: 'be', parent: 'plan', title: '接口开发', start: day(1), end: day(8) },
    { id: 'qa', parent: 'plan', title: '测试', start: day(11), end: day(13) },
    { id: 'demo', parent: 'plan', title: '迭代演示', type: 'milestone', start: day(14) },
    { id: 'share', title: '技术分享' },
  ],
  links: [
    { id: 'l1', from: 'spec', to: 'ui' },
    { id: 'l2', from: 'ui', to: 'fe' },
    { id: 'l3', from: 'fe', to: 'qa' },
    { id: 'l4', from: 'qa', to: 'demo' },
  ],
})

const readonly = ref(false)
const gantt = useTemplateRef<GanttExpose>('gantt')
const canUndo = computed(() => gantt.value?.canUndo ?? false)
const canRedo = computed(() => gantt.value?.canRedo ?? false)

// a finished task doesn't wait for anything new
function canLink(link: Pick<GanttLink, 'to'>) {
  const to = plan.value.tasks.find((task) => task.id === link.to)
  return to?.progress === 1 ? '已完成的任务不能再加前置任务' : true
}
</script>

<template>
  <DouSpace align="center" wrap>
    <DouButton
      variant="outline"
      size="sm"
      aria-label="撤销"
      :disabled="readonly || !canUndo"
      @click="gantt?.undo()"
      ><UndoIcon
    /></DouButton>
    <DouButton
      variant="outline"
      size="sm"
      aria-label="重做"
      :disabled="readonly || !canRedo"
      @click="gantt?.redo()"
      ><RedoIcon
    /></DouButton>
    <DouSwitch v-model="readonly">只读</DouSwitch>
    <DouText variant="secondary" size="sm"
      >双击单元格修改，右键打开菜单；“技术分享”还没排期，在它那一行的时间轴上拖动试试</DouText
    >
  </DouSpace>
  <DouGantt
    ref="gantt"
    v-model="plan"
    :readonly="readonly"
    :can-link="canLink"
    :table-width="320"
  />
</template>
