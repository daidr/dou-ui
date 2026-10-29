<script setup>
import { ref } from 'vue'

const region = ref('sh')
const regions = [
  { value: 'sh', label: '上海', description: '华东 2 · 延迟最低' },
  { value: 'bj', label: '北京', description: '华北 2' },
  { value: 'sg', label: '新加坡', description: '亚太东南 1' },
  { value: 'fra', label: '法兰克福', description: '欧洲中部 1', disabled: true },
]
</script>

<template>
  <DouListbox v-model="region" :options="regions" aria-label="区域" style="width: 280px" />
</template>
