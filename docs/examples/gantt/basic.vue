<script setup>
import { DouGantt } from '@dou-ui/gantt'
import { ref } from 'vue'
import { day } from './dates'

const tasks = ref([
  { id: 'release', title: '发布 2.0' },
  { id: 'review', parent: 'release', title: '需求评审', start: day(-9), end: day(-7), progress: 1 },
  {
    id: 'design',
    parent: 'release',
    title: '交互与视觉设计',
    start: day(-6),
    end: day(-1),
    progress: 1,
  },
  { id: 'web', parent: 'release', title: '前端开发', start: day(0), end: day(9), progress: 0.3 },
  { id: 'api', parent: 'release', title: '接口开发', start: day(-2), end: day(6), progress: 0.5 },
  { id: 'test', parent: 'release', title: '联调测试', start: day(10), end: day(14) },
  { id: 'launch', parent: 'release', title: '上线', type: 'milestone', start: day(15) },
  { id: 'ops', title: '运营准备' },
  { id: 'copy', parent: 'ops', title: '发布文案', start: day(5), end: day(11), progress: 0.2 },
  { id: 'event', parent: 'ops', title: '上海线下分享会', start: day(16), end: day(17) },
  { id: 'retro', title: '复盘' },
])

const links = ref([
  { id: 'l1', from: 'review', to: 'design' },
  { id: 'l2', from: 'design', to: 'web' },
  { id: 'l3', from: 'web', to: 'test' },
  { id: 'l4', from: 'api', to: 'test' },
  { id: 'l5', from: 'test', to: 'launch' },
  { id: 'l6', from: 'launch', to: 'event' },
])
</script>

<template>
  <DouGantt v-model:tasks="tasks" v-model:links="links" />
</template>
