<script setup lang="ts">
import { DouGantt, type GanttLink, type GanttTask } from '@dou-ui/gantt'
import { DouButton, DouSpace } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const tasks = ref<GanttTask[]>([
  { id: 'p', title: '会员中心改版' },
  { id: 'ui', parent: 'p', title: '设计稿', start: day(-4), end: day(0), progress: 1 },
  { id: 'fe', parent: 'p', title: '前端开发', start: day(1), end: day(8), progress: 0.4 },
  { id: 'qa', parent: 'p', title: '测试', start: day(9), end: day(11) },
  { id: 'go', parent: 'p', title: '上线', type: 'milestone', start: day(12), tone: 'primary' },
])
const links = ref<GanttLink[]>([
  { id: 'l1', from: 'ui', to: 'fe' },
  { id: 'l2', from: 'fe', to: 'qa' },
  { id: 'l3', from: 'qa', to: 'go' },
])

const gantt = useTemplateRef('gantt')

function save(data: Blob | string, name: string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

async function savePNG() {
  if (gantt.value) save(await gantt.value.exportPNG(), '排期.png')
}
// 开头加上 BOM，表格软件才能认出中文
const saveCSV = () => gantt.value && save(gantt.value.exportCSV(), '排期.csv', 'text/csv')
const saveSVG = () => gantt.value && save(gantt.value.exportSVG(), '排期.svg', 'image/svg+xml')
</script>

<template>
  <DouSpace>
    <DouButton size="sm" @click="savePNG">导出 PNG</DouButton>
    <DouButton size="sm" @click="saveSVG">导出 SVG</DouButton>
    <DouButton size="sm" @click="saveCSV">导出 CSV</DouButton>
    <DouButton size="sm" @click="gantt?.print()">打印</DouButton>
  </DouSpace>
  <DouGantt
    ref="gantt"
    v-model:tasks="tasks"
    v-model:links="links"
    :markers="[{ date: day(12), label: '发布', tone: 'primary' }]"
    :table-width="300"
    style="height: 260px"
  />
</template>
