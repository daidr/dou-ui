<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import { ref } from 'vue'

const money = '¥#,##0'

const book = ref<SheetWorkbook>({
  styles: {
    head: { bold: true, fill: 'neutral' },
    total: { bold: true },
  },
  sheets: [
    {
      name: '门店销售',
      colSizes: { 0: 92, 1: 80, 2: 56, 3: 88, 4: 88, 5: 72, 6: 76 },
      cells: [
        [
          { value: '门店', style: 'head' },
          { value: '杯数', style: 'head' },
          { value: '单价', style: 'head' },
          { value: '销售额', style: 'head' },
          { value: '目标', style: 'head' },
          { value: '完成率', style: 'head' },
          { value: '评价', style: 'head' },
        ],
        ...(
          [
            ['上海静安', 1280, 18, 20000],
            ['上海徐汇', 960, 18, 18000],
            ['杭州西湖', 1105, 16, 16000],
            ['苏州园区', 640, 16, 12000],
          ] as const
        ).map(([store, cups, price, goal], i) => {
          const r = i + 2
          return [
            store,
            cups,
            { value: price, format: money },
            { value: `=B${r}*C${r}`, format: money },
            { value: goal, format: money },
            { value: `=D${r}/E${r}`, format: '0.0%' },
            `=IF(F${r}>=1,"达成",IF(F${r}>=0.9,"接近","未达成"))`,
          ]
        }),
        [],
        [
          { value: '合计', style: 'total' },
          '=SUM(B2:B5)',
          null,
          { value: '=SUM(D2:D5)', format: money, style: 'total' },
          { value: '=SUM(E2:E5)', format: money },
          { value: '=D7/E7', format: '0.0%', style: 'total' },
          '=COUNTIF(G2:G5,"达成")&" 家达成"',
        ],
        [
          '上海门店',
          '=SUMIF(A2:A5,"上海*",B2:B5)',
          null,
          { value: '=SUMIF(A2:A5,"上海*",D2:D5)', format: money },
        ],
        ['最好的门店', '=INDEX(A2:A5,MATCH(MAX(F2:F5),F2:F5,0))'],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px" />
</template>
