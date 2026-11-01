<script setup lang="ts">
import { spanOf, type GanttTask } from '@dou-ui/gantt'
import {
  DouScheduler,
  type SchedulerMove,
  type SchedulerRange,
  type SchedulerResource,
} from '@dou-ui/gantt/scheduler'
import { toast } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { workday } from './dates'

const resources: SchedulerResource[] = [
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

// 同一间会议室的预约不能重叠
function taken(range: SchedulerMove | SchedulerRange, except?: string) {
  const own = spanOf({ id: '', title: '', start: range.start, end: range.end })!
  return tasks.value.some((item) => {
    if (item.id === except || item.resource !== range.resource) return false
    const span = spanOf(item)
    return !!span && span.start < own.end && own.start < span.end
  })
}

const canMove = (move: SchedulerMove) =>
  !move.resource || !taken(move, move.task.id) || '这段时间已有预约'

const scheduler = useTemplateRef('scheduler')

// 在空白处拖出一段时间，按这段时间新建预约，作为一次修改提交，可以撤销
function book(range: SchedulerRange) {
  if (taken(range)) return void toast.warning('这段时间已有预约')
  scheduler.value?.transact((tr) =>
    tr.addTask({ id: crypto.randomUUID(), title: '新预约', tone: 'primary', ...range }),
  )
}
</script>

<template>
  <DouScheduler
    ref="scheduler"
    v-model:tasks="tasks"
    :resources="resources"
    :calendar="{ hours: ['09:00', '18:00'] }"
    :can-move="canMove"
    scale="hour"
    :load="false"
    style="height: 320px"
    @create="book"
  />
</template>
