<script setup>
import { DouChart, DouChartAxis, DouChartTooltip, DouChartWaterfall } from '@dou-ui/chart'

// 上海一家门店一季度的利润构成（万元）
const rows = [
  { item: '营业收入', amount: 1260 },
  { item: '营业成本', amount: -720 },
  { item: '毛利', total: true },
  { item: '销售费用', amount: -168 },
  { item: '管理费用', amount: -96 },
  { item: '其他收益', amount: 42 },
  { item: '净利润', total: true },
]
</script>

<template>
  <DouChart :data="rows" x="item" :height="300">
    <DouChartAxis for="y" title="万元" />
    <DouChartWaterfall y="amount" total="total" name="金额" labels />
    <DouChartTooltip />
  </DouChart>
</template>
