<script setup lang="ts">
import { DouGantt, type GanttDocument } from '@dou-ui/gantt'
import { MaximizeIcon, RedoIcon, UndoIcon, ZoomInIcon, ZoomOutIcon } from '@dou-ui/icons'
import { DouButton, DouToolbar, DouToolbarSeparator } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'ui', title: '设计稿', start: day(-3), end: day(1), progress: 0.6 },
    { id: 'fe', title: '前端开发', start: day(2), end: day(9) },
    { id: 'qa', title: '测试', start: day(10), end: day(12) },
    { id: 'go', title: '上线', type: 'milestone', start: day(13) },
  ],
  links: [
    { id: 'l1', from: 'ui', to: 'fe' },
    { id: 'l2', from: 'fe', to: 'qa' },
    { id: 'l3', from: 'qa', to: 'go' },
  ],
})

const gantt = useTemplateRef('gantt')
</script>

<template>
  <DouToolbar size="sm" aria-label="甘特图操作">
    <DouButton variant="ghost" aria-label="撤销" :disabled="!gantt?.canUndo" @click="gantt?.undo()"
      ><UndoIcon
    /></DouButton>
    <DouButton variant="ghost" aria-label="重做" :disabled="!gantt?.canRedo" @click="gantt?.redo()"
      ><RedoIcon
    /></DouButton>
    <DouToolbarSeparator />
    <DouButton variant="ghost" aria-label="缩小" @click="gantt?.zoomOut()"
      ><ZoomOutIcon
    /></DouButton>
    <DouButton variant="ghost" aria-label="放大" @click="gantt?.zoomIn()"><ZoomInIcon /></DouButton>
    <DouButton variant="ghost" aria-label="显示全部任务" @click="gantt?.fit()"
      ><MaximizeIcon
    /></DouButton>
    <DouToolbarSeparator />
    <DouButton variant="ghost" @click="gantt?.scrollToToday()">今天</DouButton>
  </DouToolbar>
  <DouGantt ref="gantt" v-model="plan" :table-width="300" style="height: 260px" />
</template>
