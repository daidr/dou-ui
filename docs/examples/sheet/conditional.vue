<script setup lang="ts">
import { DouSheet, DouSheetToolbar, type SheetWorkbook } from '@dou-ui/sheet'
import { ref } from 'vue'

const stores = [
  ['静安店', '上海', 420, 468, 0.12],
  ['徐汇店', '上海', 380, 341, -0.06],
  ['西湖店', '杭州', 300, 322, 0.04],
  ['滨江店', '杭州', 260, 198, -0.15],
  ['姑苏店', '苏州', 240, 251, 0.02],
  ['园区店', '苏州', 280, 305, 0.09],
  ['新街口店', '南京', 320, 287, -0.03],
  ['河西店', '南京', 220, 236, 0.07],
] as const

const head = (value: string) => ({ value, style: 'head' })
const money = (value: number) => ({ value, format: '#,##0"万"' })

const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '三月门店',
      freeze: { rows: 1 },
      colSizes: { 0: 88, 1: 64, 2: 80, 3: 112, 4: 72, 5: 72 },
      cells: [
        [head('门店'), head('城市'), head('目标'), head('实际'), head('完成率'), head('环比')],
        ...stores.map(([store, city, goal, actual, change], i) => [
          store,
          city,
          money(goal),
          money(actual),
          { value: `=D${i + 2}/C${i + 2}`, format: '0%' },
          { value: change, format: '0%' },
        ]),
      ],
      conditionalFormats: [
        // 没完成目标的门店，完成率标红
        { range: 'E2:E9', when: { op: 'lt', value: 1 }, style: { tone: 'danger', fill: 'danger' } },
        // 实际销售额画数据条
        { range: 'D2:D9', bar: true },
        // 环比从降到升，由红到绿
        { range: 'F2:F9', scale: ['danger', 'neutral', 'success'] },
        // 超出目标一成的门店，店名加粗
        { range: 'A2:A9', formula: '=$D2>$C2*1.1', style: { bold: true } },
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 340px">
    <template #header>
      <DouSheetToolbar :tools="['undo', 'redo', '|', 'conditional']" />
    </template>
  </DouSheet>
</template>
