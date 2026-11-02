<script setup lang="ts">
import type { GanttDocument } from '@dou-ui/gantt'
import { DouScheduler, type SchedulerResource } from '@dou-ui/gantt/scheduler'
import { ref } from 'vue'
import { day } from './dates'

const resources: SchedulerResource[] = [
  { id: 'daidou', title: '戴兜', group: '设计' },
  { id: 'aqing', title: '阿青', group: '设计' },
  { id: 'xiaoman', title: '林小满', group: '开发', capacity: 2 },
  { id: 'zhouzhou', title: '周舟', group: '开发' },
]

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'a', title: '会员页改版', resource: 'daidou', start: day(-3), end: day(2) },
    { id: 'b', title: '图标补齐', resource: 'daidou', start: day(1), end: day(4), tone: 'primary' },
    { id: 'c', title: '活动海报', resource: 'aqing', start: day(-1), end: day(3) },
    { id: 'd', title: '支付接入', resource: 'xiaoman', start: day(-4), end: day(5) },
    { id: 'e', title: '账单导出', resource: 'xiaoman', start: day(0), end: day(2) },
    { id: 'f', title: '修复崩溃', resource: 'xiaoman', start: day(1), end: day(1), tone: 'danger' },
    { id: 'g', title: '搜索提速', resource: 'zhouzhou', start: day(2), end: day(8) },
    { id: 'h', title: '整理需求', start: day(4), end: day(5) },
  ],
  links: [],
})
</script>

<template>
  <DouScheduler v-model="plan" :resources="resources" scale="day" style="height: 360px" />
</template>
