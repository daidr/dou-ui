<script setup lang="ts">
import { ref } from 'vue'

const value = ref(64)
const stops = [
  { percent: 60, color: 'var(--dou-color-success)' },
  { percent: 85, color: 'var(--dou-color-warning)' },
  { percent: 100, color: 'var(--dou-color-danger)' },
]
</script>

<template>
  <div style="display: grid; gap: 16px; width: 100%; max-width: 420px">
    <DouProgress :value="value" text-inside tone="primary" label="上传进度" />
    <DouProgress :value="value" :color="stops" show-value label="存储空间" />
    <DouProgress :value="value" type="circle" :color="stops" show-value label="存储空间" />
    <DouSlider v-model="value" aria-label="调整进度" />
  </div>
</template>
