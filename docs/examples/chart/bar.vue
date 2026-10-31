<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 四个季度线上和门店的销售额（万元）
const rows = [
  { quarter: '一季度', online: 128, store: 96 },
  { quarter: '二季度', online: 152, store: 104 },
  { quarter: '三季度', online: 141, store: 118 },
  { quarter: '四季度', online: 186, store: 132 },
]
</script>

<template>
  <DouChart :data="rows" x="quarter" :height="300">
    <DouChartAxis position="left" title="销售额（万元）" />
    <DouChartBar y="online" name="线上" />
    <DouChartBar y="store" name="门店" />
  </DouChart>
</template>
