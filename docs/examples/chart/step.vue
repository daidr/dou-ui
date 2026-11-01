<script setup>
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 上海仓一周的库存：入库、出库之后才变化，变化之间保持不变
const rows = [
  { time: '2026-10-26 08:00', stock: 1200 },
  { time: '2026-10-26 15:00', stock: 860 },
  { time: '2026-10-27 10:00', stock: 2160 },
  { time: '2026-10-28 09:00', stock: 1740 },
  { time: '2026-10-28 17:00', stock: 1320 },
  { time: '2026-10-29 14:00', stock: 980 },
  { time: '2026-10-30 11:00', stock: 2400 },
  { time: '2026-10-31 16:00', stock: 1880 },
  { time: '2026-11-01 12:00', stock: 1560 },
]
const pieces = (value) => `${value} 件`
</script>

<template>
  <DouChart :data="rows" x="time" :height="280">
    <DouChartAxis for="y" :format="pieces" />
    <DouChartLine y="stock" name="库存" step dots />
  </DouChart>
</template>
