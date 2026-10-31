<script setup>
import { DouSheet, DouSheetTabs } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const month = (name, rows) => ({
  name,
  freeze: { rows: 1 },
  colCount: 8,
  rowCount: 30,
  colSizes: { 0: 120 },
  cells: [[head('门店'), head('销售额'), head('客单价')], ...rows],
})

const book = ref({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    month('九月', [
      ['上海静安', 182400, 96],
      ['上海徐汇', 154300, 88],
    ]),
    month('十月', [
      ['上海静安', 196800, 101],
      ['上海徐汇', 162900, 92],
    ]),
  ],
})
const active = ref(1)
</script>

<template>
  <DouSheet v-model="book" v-model:active-sheet="active" style="height: 300px">
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
