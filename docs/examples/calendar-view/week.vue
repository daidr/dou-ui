<script setup>
import { ref } from 'vue'

const date = ref('2026-10-29')
const view = ref('week')
const last = ref('—')
const events = [
  { date: '2026-10-26', end: '2026-10-28', title: '上海出差', tone: 'warning' },
  { date: '2026-10-29', title: '第 21 批开工' },
  { date: '2026-10-26', time: '10:00', endTime: '11:00', title: '周会', tone: 'neutral' },
  { date: '2026-10-27', time: '09:30', endTime: '12:00', title: '客户拜访', tone: 'warning' },
  { date: '2026-10-28', time: '14:00', endTime: '15:30', title: '设计评审' },
  { date: '2026-10-28', time: '15:00', endTime: '16:00', title: '图标复审', tone: 'success' },
  { date: '2026-10-30', time: '16:30', endTime: '17:30', title: '和戴兜对齐', tone: 'neutral' },
  { date: '2026-10-29', time: '09:00', endTime: '09:15', title: '站会', tone: 'neutral' },
  { date: '2026-10-29', time: '13:00', endTime: '17:00', title: '日历视图开发' },
  { date: '2026-10-30', time: '11:00', endTime: '12:00', title: '修复回归问题', tone: 'danger' },
  { date: '2026-10-31', time: '19:00', endTime: '21:00', title: '读书会', tone: 'success' },
]
</script>

<template>
  <DouCalendarView
    v-model="date"
    v-model:view="view"
    :views="['month', 'week', 'day']"
    :events="events"
    :hours="[8, 22]"
    scroll-time="09:00"
    @event-click="(event) => (last = event.title)"
    @time-click="({ date, time }) => (last = `${date} ${time} 空闲`)"
  />
  <DouText size="sm" variant="tertiary">选中：{{ date }}　最近点击：{{ last }}</DouText>
</template>
