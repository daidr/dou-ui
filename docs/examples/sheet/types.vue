<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const task = (title, owner, status, due, done) => [
  { value: done, type: 'checkbox' },
  title,
  owner,
  { value: status, type: 'status' },
  { value: due, type: 'date' },
]

const book = ref({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  types: {
    status: {
      type: 'select',
      options: [
        '未开始',
        { value: '进行中', tone: 'primary' },
        { value: '待验收', tone: 'warning' },
        { value: '已完成', tone: 'success' },
      ],
    },
  },
  sheets: [
    {
      name: '任务',
      freeze: { rows: 1 },
      colCount: 6,
      rowCount: 20,
      colSizes: { 0: 56, 1: 200, 4: 120 },
      cells: [
        [head('完成'), head('任务'), head('负责人'), head('状态'), head('截止日期')],
        task('整理上海门店的季度数据', '戴兜', '已完成', '2026-10-20', true),
        task('确定新版首页的配色', '戴兜', '待验收', '2026-10-28', false),
        task('补充表格组件的文档', '阿青', '进行中', '2026-11-03', false),
        task('准备月度分享', '小林', '未开始', '2026-11-12', false),
        task('复盘十月的用户反馈', '阿青', '进行中', '2026-11-05', false),
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 280px" />
</template>
