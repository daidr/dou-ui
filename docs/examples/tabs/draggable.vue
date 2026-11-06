<script setup>
import { ref } from 'vue'

const pages = ref([
  { value: 'sh', label: '上海' },
  { value: 'bj', label: '北京' },
  { value: 'sz', label: '深圳' },
  { value: 'hz', label: '杭州' },
])
const current = ref('sh')

function move({ from, to }) {
  const [page] = pages.value.splice(from.index, 1)
  pages.value.splice(to.index, 0, page)
}
</script>

<template>
  <DouTabs v-model="current" draggable @move="move">
    <DouTabPanel v-for="page in pages" :key="page.value" :value="page.value" :label="page.label">
      {{ page.label }}的内容。拖动标签，或者聚焦标签后按 Alt + ← / →，调整顺序。
    </DouTabPanel>
  </DouTabs>
</template>
