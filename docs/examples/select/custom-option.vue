<script setup>
import { ref } from 'vue'

const region = ref('sh')
const regions = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'sfo', label: '旧金山' },
]
</script>

<template>
  <DouSelect v-model="region" :options="regions">
    <template #option="{ option }">
      {{ option.label }}
      <DouText variant="tertiary" size="sm" style="margin-left: 6px">
        {{ option.value }}
      </DouText>
    </template>
  </DouSelect>
</template>
