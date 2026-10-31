<script setup lang="ts">
import { DouGantt, type GanttLink, type GanttTask } from '@dou-ui/gantt'
import { DouButton, DouSpace, DouSwitch } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const tasks = ref<GanttTask[]>([
  { id: 'spec', title: '写需求文档', start: day(-3), end: day(-1) },
  { id: 'ui', title: '设计稿', start: day(0), end: day(3) },
  { id: 'be', title: '接口开发', start: day(0), end: day(5) },
  { id: 'fe', title: '前端开发', start: day(4), end: day(8) },
  { id: 'doc', title: '使用文档', start: day(6), end: day(7) },
  { id: 'qa', title: '测试', start: day(9), end: day(11) },
  { id: 'go', title: '上线', type: 'milestone', start: day(11) },
])
const links = ref<GanttLink[]>([
  { id: 'l1', from: 'spec', to: 'ui' },
  { id: 'l2', from: 'spec', to: 'be' },
  { id: 'l3', from: 'ui', to: 'fe' },
  { id: 'l4', from: 'be', to: 'qa' },
  { id: 'l5', from: 'fe', to: 'qa' },
  { id: 'l6', from: 'doc', to: 'go' },
  { id: 'l7', from: 'qa', to: 'go' },
])

const columns = [{ key: 'title' }, { key: 'duration', width: 72 }]

const auto = ref(true)
const critical = ref(true)
const gantt = useTemplateRef('gantt')
</script>

<template>
  <DouSpace align="center">
    <DouSwitch v-model="auto">自动排期</DouSwitch>
    <DouSwitch v-model="critical">关键路径</DouSwitch>
    <DouButton variant="outline" size="sm" @click="gantt?.schedule({ pull: true })"
      >紧凑排期</DouButton
    >
  </DouSpace>
  <DouGantt
    ref="gantt"
    v-model:tasks="tasks"
    v-model:links="links"
    :scheduling="auto ? 'auto' : 'manual'"
    :critical="critical"
    :columns="columns"
    :table-width="220"
    style="height: 320px"
  />
</template>
