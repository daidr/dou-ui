<script setup>
import { ref } from 'vue'

const status = ref('all')
const statuses = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '进行中' },
  { value: 'review', label: '待审核' },
  { value: 'done', label: '已完成' },
]

const topics = ref(['design', 'a11y'])
const topicOptions = [
  { value: 'design', label: '设计' },
  { value: 'perf', label: '性能' },
  { value: 'a11y', label: '无障碍' },
  { value: 'docs', label: '文档' },
  { value: 'test', label: '测试' },
]
</script>

<template>
  <DouCheckTagGroup v-model="status" :options="statuses" />
  <DouCheckTagGroup v-model="topics" :options="topicOptions" multiple round tone="primary" />
  <DouText variant="secondary">
    已选：{{
      topicOptions
        .filter((o) => topics.includes(o.value))
        .map((o) => o.label)
        .join('、') || '无'
    }}
  </DouText>
</template>
