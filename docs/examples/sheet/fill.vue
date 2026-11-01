<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

// 选中第 2 行的一格或两格，拖动右下角的填充柄向下延伸
const book = ref({
  version: 1,
  sheets: [
    {
      name: '排期',
      cells: [
        ['周次', '开始日期', '月末结算', '序号', '步长 5', '负责人'],
        ['第 1 周', '2026-11-02', '2026-01-31', 1, 5, '戴兜'],
        [null, '2026-11-09', '2026-02-28', null, 10],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 260px" />
</template>
