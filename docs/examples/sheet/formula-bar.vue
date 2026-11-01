<script setup lang="ts">
import { DouSheet, DouSheetFormulaBar, type SheetWorkbook } from '@dou-ui/sheet'
import { ref } from 'vue'

const money = '¥#,##0'

const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '季度费用',
      freeze: { rows: 1 },
      colSizes: { 0: 96 },
      cells: [
        [
          { value: '项目', style: 'head' },
          { value: '一月', style: 'head' },
          { value: '二月', style: 'head' },
          { value: '三月', style: 'head' },
          { value: '合计', style: 'head' },
          { value: '占比', style: 'head' },
        ],
        ...(
          [
            ['差旅', 4200, 3800, 5100],
            ['办公用品', 860, 1240, 730],
            ['培训', 3000, 0, 4500],
            ['团建', 0, 2600, 1800],
          ] as const
        ).map(([name, a, b, c], i) => {
          const r = i + 2
          return [
            name,
            { value: a, format: money },
            { value: b, format: money },
            { value: c, format: money },
            { value: `=SUM(B${r}:D${r})`, format: money },
            { value: `=E${r}/$E$6`, format: '0.0%' },
          ]
        }),
        [
          '合计',
          { value: '=SUM(B2:B5)', format: money },
          { value: '=SUM(C2:C5)', format: money },
          { value: '=SUM(D2:D5)', format: money },
          { value: '=SUM(E2:E5)', format: money },
        ],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 300px">
    <template #header>
      <DouSheetFormulaBar />
    </template>
  </DouSheet>
</template>
