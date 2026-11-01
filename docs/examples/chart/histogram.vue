<script setup>
import { DouChart, DouChartAxis, DouChartHistogram, DouChartTooltip } from '@dou-ui/chart'

// 一家奶茶店一天 300 笔订单的等待时间（分钟），用固定的种子生成
let seed = 7
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const rows = Array.from({ length: 300 }, () => {
  // 大多数订单 4 分钟左右，高峰时段少数要等更久
  const base = 2 + random() * 2 + random() * 2 + random() * 2
  return { wait: random() < 0.12 ? base + 4 + random() * 6 : base }
})
</script>

<template>
  <DouChart :data="rows" :height="280">
    <DouChartAxis for="x" title="等待时间（分钟）" />
    <DouChartAxis for="y" title="订单数" />
    <DouChartHistogram value="wait" name="订单数" />
    <DouChartTooltip />
  </DouChart>
</template>
