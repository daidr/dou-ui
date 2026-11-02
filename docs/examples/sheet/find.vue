<script setup>
import { DouSheet, DouSheetTabs, DouSheetToolbar } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const price = (value) => ({ value, format: '¥#,##0.00' })

const book = ref({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '上海办公室',
      colCount: 6,
      rowCount: 30,
      freeze: { rows: 1 },
      cells: [
        [head('物品'), head('单价'), head('数量'), head('小计'), head('经手人')],
        ['白板笔', price(12), 6, '=B2*C2', '戴兜'],
        ['便签纸', price(8), 20, '=B3*C3', '阿青'],
        ['白板擦', price(15), 2, '=B4*C4', '戴兜'],
        ['移动白板', price(680), 1, '=B5*C5', '小林'],
        ['合计', null, null, '=SUM(D2:D5)'],
      ],
    },
    {
      name: '杭州办公室',
      colCount: 6,
      rowCount: 30,
      cells: [
        [head('物品'), head('单价'), head('数量'), head('小计'), head('经手人')],
        ['白板笔', price(12), 4, '=B2*C2', '阿青'],
        ['投影仪', price(3200), 1, '=B3*C3', '小林'],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px">
    <template #header>
      <DouSheetToolbar :tools="['undo', 'redo', '|', 'find', 'replace']" />
    </template>
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
