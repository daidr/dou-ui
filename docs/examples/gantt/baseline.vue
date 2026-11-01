<script setup lang="ts">
import { DouGantt, takeBaseline, type GanttBaselineItem, type GanttDocument } from '@dou-ui/gantt'
import { DouButton, DouSpace } from 'dou-ui'
import { ref } from 'vue'
import { day } from './dates'

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'ui', title: '设计稿', start: day(-6), end: day(-1), progress: 1 },
    { id: 'fe', title: '前端开发', start: day(0), end: day(8), progress: 0.3 },
    { id: 'api', title: '接口联调', start: day(4), end: day(9) },
    { id: 'qa', title: '测试', start: day(10), end: day(13) },
    { id: 'go', title: '上线', type: 'milestone', start: day(14) },
  ],
  links: [
    { id: 'l1', from: 'ui', to: 'fe' },
    { id: 'l2', from: 'fe', to: 'qa' },
    { id: 'l3', from: 'api', to: 'qa' },
    { id: 'l4', from: 'qa', to: 'go' },
  ],
})

// 立项时保存的计划：设计稿多用了两天，后面的任务跟着推迟
const baseline = ref<GanttBaselineItem[] | undefined>([
  { id: 'ui', start: day(-6), end: day(-3) },
  { id: 'fe', start: day(-2), end: day(6) },
  { id: 'api', start: day(3), end: day(8) },
  { id: 'qa', start: day(8), end: day(11) },
  { id: 'go', start: day(12) },
])
</script>

<template>
  <DouSpace>
    <DouButton size="sm" @click="baseline = takeBaseline(plan.tasks)"
      >把当前日期保存为基线</DouButton
    >
    <DouButton size="sm" variant="ghost" :disabled="!baseline" @click="baseline = undefined">
      不显示基线
    </DouButton>
  </DouSpace>
  <DouGantt v-model="plan" :baseline="baseline" :table-width="300" style="height: 260px" />
</template>
