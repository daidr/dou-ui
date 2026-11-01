<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 各品类的销售额（万元），数据没有排序
const sales = [
  { kind: '家电', value: 86 },
  { kind: '服饰', value: 142 },
  { kind: '食品', value: 118 },
  { kind: '图书', value: 34 },
  { kind: '美妆', value: 97 },
  { kind: '运动', value: 61 },
]
</script>

<template>
  <DouChart :data="sales" x="kind" horizontal :height="260">
    <DouChartAxis for="x" sort="desc" />
    <DouChartAxis for="y" title="销售额（万元）" />
    <DouChartBar y="value" name="销售额" />
  </DouChart>
</template>
