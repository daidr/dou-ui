<script setup>
import { DouGantt } from '@dou-ui/gantt'
import { ref } from 'vue'

// a holiday on Thursday and Friday, made up on a Sunday; a lunch break from 12 to 13
const calendar = {
  holidays: ['2026-10-01', '2026-10-02'],
  workdays: ['2026-10-11'],
  hours: [
    ['09:00', '12:00'],
    ['13:00', '18:00'],
  ],
}

const tasks = ref([
  { id: 'prep', title: '整理需求', start: '2026-09-28', end: '2026-09-30', progress: 1 },
  { id: 'write', title: '撰写方案', start: '2026-10-09', end: '2026-10-12' },
  { id: 'meet', title: '方案评审会', start: '2026-10-13 14:00', end: '2026-10-13 16:30' },
  { id: 'fix', title: '根据意见修改', start: '2026-10-13 16:30', end: '2026-10-14 12:00' },
  { id: 'sign', title: '定稿', type: 'milestone', start: '2026-10-14 17:00' },
])
const links = ref([
  { id: 'a', from: 'prep', to: 'write' },
  { id: 'b', from: 'write', to: 'meet' },
  { id: 'c', from: 'meet', to: 'fix' },
  { id: 'd', from: 'fix', to: 'sign' },
])
const columns = [{ key: 'title' }, { key: 'start', width: 120 }, { key: 'duration', width: 80 }]
</script>

<template>
  <DouGantt
    v-model:tasks="tasks"
    v-model:links="links"
    :calendar="calendar"
    :columns="columns"
    readonly
    :table-width="380"
    style="height: 260px"
  />
</template>
