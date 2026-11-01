<script setup>
import { CalendarPlusIcon, CopyIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const date = ref('2026-10-28')
const view = ref('week')
const last = ref('—')
const events = ref([
  { id: '1', start: '2026-10-26', end: '2026-10-27', title: '上海出差', tone: 'warning' },
  { id: '2', start: '2026-10-26 10:00', end: '2026-10-26 11:00', title: '周会', tone: 'neutral' },
  {
    id: '3',
    start: '2026-10-27 14:00',
    end: '2026-10-27 16:00',
    title: '全员大会',
    tone: 'danger',
    locked: true,
  },
  { id: '4', start: '2026-10-28 09:30', end: '2026-10-28 11:00', title: '设计评审' },
  {
    id: '5',
    start: '2026-10-29 13:00',
    end: '2026-10-29 15:30',
    title: '和戴兜对齐排期',
    tone: 'success',
  },
  { id: '6', start: '2026-10-30 16:00', title: '版本复盘', tone: 'neutral' },
])

let next = 7
const add = (range, title = '新日程') => {
  events.value = [...events.value, { id: String(next++), title, ...range }]
}

// 带时间的日程只能排在 8:00 到 20:00 之间
const canMove = ({ start, end }) => {
  if (start.length < 16) return true
  const sameDay = start.slice(0, 10) === end.slice(0, 10)
  return (
    (sameDay && start.slice(11) >= '08:00' && end.slice(11) <= '20:00') ||
    '只能排在 8:00 到 20:00 之间'
  )
}

const contextMenu = (target) => {
  if (target.kind === 'event')
    return [
      {
        key: 'copy',
        label: '复制一份',
        icon: CopyIcon,
        run: () => add({ start: target.event.start, end: target.event.end }, target.event.title),
      },
    ]
  if (target.kind === 'time')
    return [
      {
        key: 'add',
        label: '在这里新建',
        icon: CalendarPlusIcon,
        run: () => add({ start: target.start }),
      },
    ]
  return []
}

const kinds = { move: '移动', resize: '调整时长', remove: '删除' }
</script>

<template>
  <DouCalendarView
    v-model="date"
    v-model:view="view"
    v-model:events="events"
    editable
    :views="['month', 'week', 'day']"
    :hours="[8, 20]"
    scroll-time="09:00"
    :can-move="canMove"
    :context-menu="contextMenu"
    @create="(range) => add(range)"
    @change="(change) => (last = `${kinds[change.kind]}“${change.event.title}”`)"
  />
  <DouText size="sm" variant="tertiary">最近的修改：{{ last }}</DouText>
</template>
