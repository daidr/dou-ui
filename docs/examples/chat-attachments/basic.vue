<script setup>
import { ref } from 'vue'

const files = ref([
  { uid: '1', name: '第三季度报告.pdf', size: 1_284_000 },
  { uid: '2', name: '用户访谈记录.docx', size: 86_000 },
  { uid: '3', name: 'node-graph.vue', size: 12_400 },
  { uid: '4', name: '销售数据.xlsx', size: 342_000 },
])
</script>

<template>
  <DouChatAttachments v-model="files" />
</template>
