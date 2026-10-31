<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

const book = ref({
  styles: {
    head: { bold: true, fill: 'neutral' },
    total: { bold: true },
  },
  sheets: [
    {
      name: '团建预算',
      colSizes: { 0: 140, 4: 120 },
      cells: [
        [
          { value: '项目', style: 'head' },
          { value: '数量', style: 'head' },
          { value: '单价', style: 'head' },
          { value: '小计', style: 'head' },
          { value: '负责人', style: 'head' },
          { value: '日期', style: 'head' },
        ],
        [
          '大巴往返',
          2,
          { value: 1800, format: '¥#,##0' },
          { value: 3600, format: '¥#,##0' },
          '戴兜',
          { value: '2026-11-14', format: 'm月d日' },
        ],
        [
          '午餐',
          36,
          { value: 85, format: '¥#,##0' },
          { value: 3060, format: '¥#,##0' },
          '阿青',
          { value: '2026-11-14', format: 'm月d日' },
        ],
        [
          '场地',
          1,
          { value: 4200, format: '¥#,##0' },
          { value: 4200, format: '¥#,##0' },
          '戴兜',
          { value: '2026-11-14', format: 'm月d日' },
        ],
        [
          '纪念品',
          36,
          { value: 48.5, format: '¥#,##0.00' },
          { value: 1746, format: '¥#,##0.00' },
          '小周',
          { value: '2026-11-10', format: 'm月d日' },
        ],
        [],
        [
          { value: '合计', style: 'total' },
          null,
          null,
          { value: 12606, format: '¥#,##0.00', style: 'total' },
        ],
        [{ value: '占年度预算', style: 'total' }, null, null, { value: 0.315, format: '0.0%' }],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px" />
</template>
