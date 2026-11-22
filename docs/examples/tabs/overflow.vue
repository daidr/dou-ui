<script setup>
import { ref } from 'vue'
import { FileTextIcon } from '@dou-ui/icons'

const months = ref(
  Array.from({ length: 12 }, (_, index) => ({
    value: `m${index + 1}`,
    label: index === 4 ? `${index + 1} 月季度经营与成本分析报表` : `${index + 1} 月报表`,
    closable: index !== 0,
  })),
)
const tab = ref('m10')

function onRemove(value) {
  const index = months.value.findIndex((item) => item.value === value)
  if (index < 0) return
  months.value.splice(index, 1)
  if (tab.value === value) {
    tab.value = months.value[Math.min(index, months.value.length - 1)]?.value
  }
}
</script>

<template>
  <DouTabs v-model="tab" closable @remove="onRemove">
    <DouTabPanel
      v-for="month in months"
      :key="month.value"
      :value="month.value"
      :label="month.label"
      :icon="FileTextIcon"
      :closable="month.closable"
    >
      {{ month.label }}的内容。
    </DouTabPanel>
  </DouTabs>
</template>
