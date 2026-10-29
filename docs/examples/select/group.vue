<script setup>
import { ref } from 'vue'

const grouped = [
  {
    label: '亚太',
    options: [
      { value: 'sh', label: '上海' },
      { value: 'sg', label: '新加坡' },
      { value: 'syd', label: '悉尼' },
    ],
  },
  {
    label: '欧洲',
    options: [
      { value: 'fra', label: '法兰克福' },
      { value: 'lhr', label: '伦敦' },
    ],
  },
  { label: '美洲（即将开放）', disabled: true, options: [{ value: 'iad', label: '弗吉尼亚' }] },
]
const groupedValue = ref('sg')
</script>

<template>
  <DouSelect v-model="groupedValue" :options="grouped" />
</template>
