<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import { ref } from 'vue'

const cities = ['上海', '杭州', '苏州', '南京']
const goods = ['咖啡豆', '挂耳包', '冷萃液', '马克杯']
const people = ['戴兜', '阿青', '小满']
const prices = [88, 39, 26, 59]

const head = (value: string) => ({ value, style: 'head' })
const rows = Array.from({ length: 24 }, (_, i) => {
  const kind = (i * 7) % 4
  const r = i + 2
  return [
    `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
    cities[(i * 3) % 4],
    goods[kind],
    ((i * 37) % 23) + 2,
    { value: prices[kind], format: '¥#,##0' },
    { value: `=D${r}*E${r}`, format: '¥#,##0' },
    people[i % 3],
  ]
})

const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '三月订单',
      freeze: { rows: 1 },
      colSizes: { 0: 104, 2: 88 },
      filter: { range: 'A1:G25' },
      cells: [
        [
          head('日期'),
          head('城市'),
          head('商品'),
          head('数量'),
          head('单价'),
          head('金额'),
          head('经手人'),
        ],
        ...rows,
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 360px" />
</template>
