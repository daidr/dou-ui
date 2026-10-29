<script setup>
import { ref } from 'vue'

const empty = ref(null)
const regions = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'sfo', label: '旧金山' },
]
</script>

<template>
  <DouSelect v-model="empty" :options="regions" clearable placeholder="选择部署区域" />
</template>
