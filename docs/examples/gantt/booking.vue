<script setup lang="ts">
import type { GanttTask } from '@dou-ui/gantt'
import { DouScheduler, type GanttResource, type SchedulerRange } from '@dou-ui/gantt/scheduler'
import { ref } from 'vue'
import { workday } from './dates'

const resources: GanttResource[] = [
  { id: 'r301', title: '301 · 6 人', group: '上海办公室 3 楼' },
  { id: 'r302', title: '302 · 12 人', group: '上海办公室 3 楼' },
  { id: 'r501', title: '501 · 20 人', group: '上海办公室 5 楼' },
]

const at = (offset: number, time: string) => `${workday(offset)} ${time}`

const tasks = ref<GanttTask[]>([
  { id: 'm1', title: '周会', resource: 'r302', start: at(0, '09:30'), end: at(0, '10:30') },
  { id: 'm2', title: '面试', resource: 'r301', start: at(0, '10:00'), end: at(0, '11:00') },
  { id: 'm3', title: '评审', resource: 'r301', start: at(0, '14:00'), end: at(0, '15:30') },
  { id: 'm4', title: '培训', resource: 'r501', start: at(0, '13:00'), end: at(0, '17:00') },
  { id: 'm5', title: '一对一', resource: 'r302', start: at(0, '16:00'), end: at(0, '16:30') },
])

let count = 0
// 在空白处拖出一段时间，按这段时间新建预约
function book(range: SchedulerRange) {
  tasks.value = [
    ...tasks.value,
    {
      id: `new-${++count}`,
      title: '新预约',
      tone: 'primary',
      ...range,
      resource: range.resource ?? undefined,
    },
  ]
}
</script>

<template>
  <DouScheduler
    v-model:tasks="tasks"
    :resources="resources"
    :calendar="{ hours: ['09:00', '18:00'] }"
    scale="hour"
    :load="false"
    style="height: 320px"
    @range-select="book"
  />
</template>
