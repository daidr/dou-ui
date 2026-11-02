<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 上海店十月每天的满座率
const rows = Array.from({ length: 31 }, (_, i) => ({
  date: new Date(2026, 9, i + 1),
  rate: Math.round(58 + 22 * Math.sin(i / 2.4) + ((i + 3) % 7 >= 5 ? 14 : 0)),
}))

const percent = (value) => `${value}%`
</script>

<template>
  <DouChart :data="rows" x="date" :height="280">
    <DouChartAxis for="y" title="满座率" :min="0" :max="100" :format="percent" />
    <DouChartBar y="rate" name="满座率" />
  </DouChart>
</template>
