<script setup>
import { DouChart, DouChartBar, DouChartMarker } from '@dou-ui/chart'

// 上海门店每月的销售额（万元）
const sales = [
  { month: '1月', amount: 86 },
  { month: '2月', amount: 72 },
  { month: '3月', amount: 95 },
  { month: '4月', amount: 104 },
  { month: '5月', amount: 118 },
  { month: '6月', amount: 112 },
  { month: '7月', amount: 126 },
  { month: '8月', amount: 131 },
]
</script>

<template>
  <DouChart :data="sales" x="month" :height="280">
    <DouChartBar y="amount" name="销售额" />
    <!-- 目标比数据都高时，纵轴会延伸到目标值 -->
    <DouChartMarker :y="140" label="月度目标 140" tone="success" />
    <DouChartMarker x="5月" label="新品上市" />
  </DouChart>
</template>
