<script setup>
import { ref } from 'vue'

const date = ref('2026-10-29')
const view = ref('week')
const last = ref('—')
const events = [
  { id: '1', start: '2026-10-26', end: '2026-10-28', title: '上海出差', tone: 'warning' },
  { id: '2', start: '2026-10-29', title: '新功能开工' },
  { id: '3', start: '2026-10-26 10:00', end: '2026-10-26 11:00', title: '周会', tone: 'neutral' },
  {
    id: '4',
    start: '2026-10-27 09:30',
    end: '2026-10-27 12:00',
    title: '客户拜访',
    tone: 'warning',
  },
  { id: '5', start: '2026-10-28 14:00', end: '2026-10-28 15:30', title: '设计评审' },
  {
    id: '6',
    start: '2026-10-28 15:00',
    end: '2026-10-28 16:00',
    title: '图标复审',
    tone: 'success',
  },
  {
    id: '7',
    start: '2026-10-30 16:30',
    end: '2026-10-30 17:30',
    title: '和戴兜对齐',
    tone: 'neutral',
  },
  { id: '8', start: '2026-10-29 09:00', end: '2026-10-29 09:15', title: '站会', tone: 'neutral' },
  { id: '9', start: '2026-10-29 13:00', end: '2026-10-29 17:00', title: '日历视图开发' },
  {
    id: '10',
    start: '2026-10-30 11:00',
    end: '2026-10-30 12:00',
    title: '修复回归问题',
    tone: 'danger',
  },
  {
    id: '11',
    start: '2026-10-31 19:00',
    end: '2026-10-31 21:00',
    title: '读书会',
    tone: 'success',
  },
  {
    id: '12',
    start: '2026-10-30 20:00',
    end: '2026-10-31 09:00',
    title: '数据库迁移',
    tone: 'warning',
  },
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
    @time-click="(start) => (last = `${start} 空闲`)"
  />
  <DouText size="sm" variant="tertiary">选中：{{ date }}　最近点击：{{ last }}</DouText>
</template>
