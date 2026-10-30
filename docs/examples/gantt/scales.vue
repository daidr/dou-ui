<script setup>
import { DouGantt } from '@dou-ui/gantt'
import { DouSegmentedControl } from 'dou-ui'
import { ref } from 'vue'
import { day } from './dates'

const scale = ref('week')
const scales = [
  { label: '小时', value: 'hour' },
  { label: '天', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '年', value: 'year' },
]

const tasks = ref([
  { id: 'q1', title: '会员体系改版' },
  { id: 'research', parent: 'q1', title: '用户访谈', start: day(-20), end: day(-6), progress: 1 },
  { id: 'plan', parent: 'q1', title: '方案与原型', start: day(-5), end: day(12), progress: 0.4 },
  { id: 'build', parent: 'q1', title: '开发', start: day(13), end: day(48) },
  { id: 'beta', parent: 'q1', title: '灰度', start: day(49), end: day(62) },
  { id: 'ga', parent: 'q1', title: '全量', type: 'milestone', start: day(63) },
])
const links = ref([
  { id: 'a', from: 'research', to: 'plan' },
  { id: 'b', from: 'plan', to: 'build' },
  { id: 'c', from: 'build', to: 'beta' },
  { id: 'd', from: 'beta', to: 'ga' },
])
</script>

<template>
  <div class="demo">
    <DouSegmentedControl v-model="scale" :options="scales" size="sm" />
    <DouGantt
      v-model:tasks="tasks"
      v-model:links="links"
      v-model:scale="scale"
      :columns="[{ key: 'title' }, { key: 'duration', width: 72 }]"
      :table-width="220"
      style="height: 320px"
    />
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>
