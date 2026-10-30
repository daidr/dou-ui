<script setup>
import { ref } from 'vue'

const paused = ref(false)
const logs = [
  '戴兜 发布了 0.20.0',
  '构建完成，用时 42 秒',
  '文档站已更新',
  '新增 3 个组件',
  '测试全部通过',
]
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <DouMarquee direction="vertical" :speed="24" :gap="12" :paused="paused" style="height: 120px">
      <DouText v-for="log in logs" :key="log" variant="secondary">{{ log }}</DouText>
    </DouMarquee>
    <DouSwitch v-model="paused">暂停</DouSwitch>
  </div>
</template>
