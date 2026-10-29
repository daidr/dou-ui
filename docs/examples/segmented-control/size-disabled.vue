<script setup>
import { ref } from 'vue'

const range = ref('周')
</script>

<template>
  <DouSpace v-for="size in ['sm', 'md', 'lg']" :key="size" size="sm">
    <DouSegmentedControl v-model="range" :size="size" :options="['日', '周', '月']" />
    <DouButton :size="size" variant="outline">导出</DouButton>
  </DouSpace>
  <DouSpace size="sm">
    <DouSegmentedControl model-value="周" disabled :options="['日', '周', '月']" />
  </DouSpace>
</template>
