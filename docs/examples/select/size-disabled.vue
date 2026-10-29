<script setup>
import { ref } from 'vue'

const region = ref('sh')
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
  <DouSelect
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    v-model="region"
    :size="size"
    :options="regions"
  />
  <DouSelect v-model="region" disabled :options="regions" />
  <DouSelect v-model="empty" invalid :options="regions" />
</template>
