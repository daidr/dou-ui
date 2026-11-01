<script setup>
import { DouChart, DouChartTooltip, DouChartTreemap } from '@dou-ui/chart'

// 上海各区门店本月的营业额（万元）
const rows = [
  {
    name: '徐汇区',
    children: [
      { name: '徐家汇店', value: 186 },
      { name: '漕河泾店', value: 124 },
      { name: '田林店', value: 68 },
      { name: '龙华店', value: 52 },
    ],
  },
  {
    name: '静安区',
    children: [
      { name: '南京西路店', value: 210 },
      { name: '静安寺店', value: 132 },
      { name: '大宁店', value: 74 },
    ],
  },
  {
    name: '浦东新区',
    children: [
      { name: '陆家嘴店', value: 168 },
      { name: '张江店', value: 96 },
      { name: '世纪公园店', value: 61 },
      { name: '金桥店', value: 44 },
      { name: '川沙店', value: 28 },
    ],
  },
  {
    name: '长宁区',
    children: [
      { name: '中山公园店', value: 88 },
      { name: '虹桥店', value: 57 },
    ],
  },
]
</script>

<template>
  <DouChart :data="rows" :height="340">
    <DouChartTreemap name="本月营业额" />
    <DouChartTooltip />
  </DouChart>
</template>
