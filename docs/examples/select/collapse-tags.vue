<script setup>
import { ref } from 'vue'

const regions = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'sfo', label: '旧金山' },
]
const many = ref(['sh', 'sg', 'fra', 'iad'])
const limited = ref(['sh'])
</script>

<template>
  <DouSelect v-model="many" :options="regions" multiple :max-tag-count="2" style="width: 260px" />
  <DouSelect
    v-model="limited"
    :options="regions"
    multiple
    :multiple-limit="2"
    placeholder="最多两项"
    style="width: 260px"
  />
</template>
