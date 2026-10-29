<script setup>
import { ref } from 'vue'

const people = Array.from({ length: 40 }, (_, i) => ({
  key: i + 1,
  label: `成员 ${String(i + 1).padStart(2, '0')}`,
  description: ['设计', '前端', '后端', '产品'][i % 4],
  disabled: i % 9 === 8,
}))
const chosen = ref([3, 7])
</script>

<template>
  <DouTransfer v-model="chosen" :data="people" />
</template>
