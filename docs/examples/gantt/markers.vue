<script setup lang="ts">
import { DouGantt, type GanttMarker, type GanttTask } from '@dou-ui/gantt'
import { ref } from 'vue'
import { day } from './dates'

const tasks = ref<GanttTask[]>([
  { id: 'fe', title: '前端开发', start: day(-2), end: day(6), progress: 0.4 },
  { id: 'be', title: '接口开发', start: day(-4), end: day(4), progress: 0.6 },
  { id: 'qa', title: '回归测试', start: day(7), end: day(10) },
])

const markers: GanttMarker[] = [
  { date: day(7), label: '代码冻结', tone: 'warning' },
  { date: day(11), label: '发布', tone: 'accent' },
]
</script>

<template>
  <DouGantt v-model:tasks="tasks" :markers="markers" :table-width="240" style="height: 220px" />
</template>
