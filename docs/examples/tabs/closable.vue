<script setup>
import { ref } from 'vue'

const tab3 = ref('sh')
const pages = ref([
  { value: 'sh', label: '上海' },
  { value: 'bj', label: '北京' },
  { value: 'sz', label: '深圳' },
])
let next = 1
function addPage() {
  const value = `new-${next}`
  pages.value.push({ value, label: `新页面 ${next++}` })
  tab3.value = value
}
function removePage(value) {
  const index = pages.value.findIndex((page) => page.value === value)
  pages.value.splice(index, 1)
  if (tab3.value === value) tab3.value = pages.value[Math.max(0, index - 1)]?.value
}
</script>

<template>
  <DouTabs v-model="tab3" closable addable @remove="removePage" @add="addPage">
    <DouTabPanel v-for="page in pages" :key="page.value" :value="page.value" :label="page.label">
      {{ page.label }}的内容。
    </DouTabPanel>
  </DouTabs>
</template>
