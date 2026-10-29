<script setup>
import { ref } from 'vue'

const region = ref('sh')
</script>

<template>
  <DouSegmentedControl
    v-model="region"
    block
    :options="[
      { value: 'sh', label: '上海' },
      { value: 'sg', label: '新加坡' },
      { value: 'fra', label: '法兰克福' },
      { value: 'iad', label: '弗吉尼亚', disabled: true },
    ]"
  />
</template>
