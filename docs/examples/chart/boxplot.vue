<script setup>
import { DouChart, DouChartAxis, DouChartBoxplot, DouChartTooltip } from '@dou-ui/chart'

// 上海四家门店一个月每天的营业额（千元），用固定的种子生成
let seed = 11
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const month = (center, spread) =>
  Array.from({ length: 30 }, () => {
    const day = center + (random() + random() + random() - 1.5) * spread
    // 偶尔有一天搞活动，营业额高出很多
    return Math.round(random() < 0.05 ? day + spread * 2.4 : day)
  })
const rows = [
  { store: '徐汇店', sales: month(42, 10) },
  { store: '静安店', sales: month(56, 14) },
  { store: '浦东店', sales: month(48, 8) },
  { store: '长宁店', sales: month(35, 12) },
]
</script>

<template>
  <DouChart :data="rows" x="store" :height="300">
    <DouChartAxis for="y" title="千元" />
    <DouChartBoxplot y="sales" name="日营业额" />
    <DouChartTooltip />
  </DouChart>
</template>
