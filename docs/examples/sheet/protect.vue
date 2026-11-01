<script setup>
import { DouSheet, DouSheetTabs, DouSheetToolbar } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const blank = (value) => ({ value, style: 'blank' })

const book = ref({
  version: 1,
  styles: {
    head: { bold: true, fill: 'neutral' },
    // 要填写的格子不锁定
    blank: { locked: false, fill: 'primary' },
  },
  sheets: [
    {
      name: '报价单',
      protect: { formatColumns: true },
      colSizes: { 0: 100, 1: 160 },
      rowCount: 10,
      colCount: 5,
      cells: [
        [head('客户'), blank('戴兜')],
        [head('城市'), blank('上海')],
        [head('数量'), blank(12)],
        [head('单价'), { value: 380, format: '¥#,##0' }],
        [head('金额'), { value: '=B3*B4', format: '¥#,##0', style: 'head' }],
      ],
    },
    { name: '备注', cells: [['这张表没有保护，可以随意修改。']] },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px">
    <template #header>
      <DouSheetToolbar />
    </template>
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
