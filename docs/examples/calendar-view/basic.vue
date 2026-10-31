<script setup>
import { ref } from 'vue'

const date = ref('2026-10-29')
const month = ref('2026-10')
const last = ref('—')
const events = [
  { start: '2026-10-08', title: '第 11 批合并', tone: 'success' },
  { start: '2026-10-12', title: '设计评审' },
  { start: '2026-10-12', title: '图标复审', tone: 'neutral' },
  { start: '2026-10-12', title: '周会', tone: 'neutral' },
  { start: '2026-10-12', title: '发版前检查', tone: 'warning' },
  { start: '2026-10-19', end: '2026-10-21', title: '上海出差', tone: 'warning' },
  { start: '2026-10-29', title: '第 13 批开工' },
  { start: '2026-10-30', title: '修复回归问题', tone: 'danger' },
]
</script>

<template>
  <DouCalendarView
    v-model="date"
    v-model:month="month"
    :events="events"
    @event-click="(event) => (last = event.title)"
  />
  <DouText size="sm" variant="tertiary">
    选中：{{ date }}　显示的月份：{{ month }}　最近点击的日程：{{ last }}
  </DouText>
</template>
