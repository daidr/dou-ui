<script setup>
import { DouSheet, DouSheetTabs, DouSheetToolbar } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const money = (value) => ({ value, format: '¥#,##0.00' })

const book = ref({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '活动预算',
      freeze: { rows: 1 },
      colCount: 8,
      rowCount: 40,
      colSizes: { 0: 120, 3: 140 },
      cells: [
        [head('项目'), head('数量'), head('单价'), head('小计'), head('负责人')],
        ['场地租赁', 1, money(12800), money(12800), '戴兜'],
        ['茶歇', 60, money(38), money(2280), '戴兜'],
        ['物料印刷', 200, money(6.5), money(1300), '阿青'],
        ['摄影', 1, money(3500), money(3500), '阿青'],
      ],
    },
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
