<script setup lang="ts">
import { ref } from 'vue'
import type { TourStep } from 'dou-ui'

const open = ref(false)
const current = ref(0)
const steps: TourStep[] = [
  { title: '欢迎使用', description: '接下来用一分钟介绍几处常用的功能。' },
  { target: '#tour-demo-export', title: '导出', description: '把当前视图导出为表格或图片。' },
]

function start() {
  current.value = 0
  open.value = true
}
</script>

<template>
  <DouSpace>
    <DouButton id="tour-demo-export" variant="outline">导出</DouButton>
    <DouButton variant="soft" @click="start">从头开始</DouButton>
  </DouSpace>
  <DouTour v-model:open="open" v-model:current="current" :steps="steps">
    <template #actions="{ next, close, current: index, total }">
      <DouButton v-if="index === 0" size="sm" variant="ghost" @click="close">跳过</DouButton>
      <DouButton size="sm" tone="primary" @click="next">
        {{ index === total - 1 ? '开始使用' : '继续' }}
      </DouButton>
    </template>
  </DouTour>
</template>
