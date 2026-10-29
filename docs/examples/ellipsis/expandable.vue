<script setup>
import { ref } from 'vue'

const expanded = ref(false)
</script>

<template>
  <DouEllipsis v-model:expanded="expanded" :lines="3" expandable style="max-width: 360px">
    戴兜在本周完成了表格的多级表头与合并单元格，修复了日期范围在跨月时高亮错位的问题，并补充了相关的单元测试。下周计划把拖拽排序接入树组件，同时整理文档里过时的示例，让每个示例都能直接复制使用。
  </DouEllipsis>
  <DouText variant="secondary">{{ expanded ? '已展开' : '已收起' }}</DouText>
</template>
