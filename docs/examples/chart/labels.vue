<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 上海各区门店上个月的销售额（万元）
const rows = [
  { district: '徐汇', sales: 186.4 },
  { district: '静安', sales: 172.9 },
  { district: '浦东', sales: 158.2 },
  { district: '黄浦', sales: 131.6 },
  { district: '长宁', sales: 98.3 },
  { district: '杨浦', sales: 76.5 },
]
const wan = (value) => `${value} 万元`
// 标签只写数字，单位看纵轴
const amount = ({ value }) => value.toFixed(1)
</script>

<template>
  <DouChart :data="rows" x="district" :height="280">
    <DouChartAxis for="y" :format="wan" />
    <DouChartBar y="sales" name="销售额" :labels="amount" />
  </DouChart>
</template>
