<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 上海各区门店的月均客单价（元），从高到低
const rows = [
  { district: '静安区', price: 168 },
  { district: '黄浦区', price: 162 },
  { district: '徐汇区', price: 149 },
  { district: '长宁区', price: 141 },
  { district: '浦东新区', price: 133 },
  { district: '杨浦区', price: 118 },
  { district: '闵行区', price: 109 },
]
</script>

<template>
  <DouChart :data="rows" x="district" horizontal :height="300">
    <DouChartAxis position="bottom" title="客单价（元）" />
    <DouChartBar y="price" name="客单价" />
  </DouChart>
</template>
