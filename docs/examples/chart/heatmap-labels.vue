<script setup>
import { DouChart, DouChartHeatmap } from '@dou-ui/chart'

// 各门店每季度的达成率
const stores = ['上海徐汇店', '上海静安店', '杭州西湖店', '南京新街口店']
const rates = [
  [0.82, 0.91, 1.04, 1.12],
  [0.95, 0.88, 0.97, 1.08],
  [0.71, 0.79, 0.86, 0.93],
  [0.9, 1.02, 1.1, 1.18],
]
const data = stores.flatMap((store, s) =>
  rates[s].map((rate, q) => ({ store, quarter: `第${q + 1}季度`, rate })),
)
const percent = (value) => `${Math.round(value * 100)}%`
</script>

<template>
  <DouChart :data="data" x="quarter" :height="240">
    <DouChartHeatmap
      y="store"
      value="rate"
      name="达成率"
      tone="success"
      :min="0.6"
      :max="1.2"
      :format="percent"
      labels
    />
  </DouChart>
</template>
