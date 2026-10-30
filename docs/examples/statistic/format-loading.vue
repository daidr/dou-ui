<script setup>
import { ref } from 'vue'

const loading = ref(true)
setTimeout(() => (loading.value = false), 2000)
const duration = (seconds) => `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
</script>

<template>
  <DouStatistic title="平均时长" :value="347" :format="duration" />
  <DouStatistic title="转化率" :value="4.62" suffix="%" :loading="loading" />
</template>
