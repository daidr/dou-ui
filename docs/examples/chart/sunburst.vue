<script setup>
import { DouChart, DouChartSunburst, DouChartTooltip } from '@dou-ui/chart'

// 戴兜本周的时间分配（小时）
const rows = [
  {
    name: '工作',
    children: [
      { name: '写代码', value: 22 },
      { name: '开会', value: 7 },
      { name: '评审', value: 5 },
      { name: '写文档', value: 4 },
    ],
  },
  {
    name: '学习',
    children: [
      { name: '读书', value: 5 },
      { name: '课程', value: 3 },
    ],
  },
  {
    name: '运动',
    children: [
      { name: '跑步', value: 4 },
      { name: '游泳', value: 2 },
    ],
  },
  { name: '其他', value: 6 },
]
const total = 58
</script>

<template>
  <DouChart :data="rows" :height="320">
    <DouChartSunburst name="本周时间">
      <div class="sunburst-total">{{ total }}</div>
      <div class="sunburst-label">小时</div>
    </DouChartSunburst>
    <DouChartTooltip />
  </DouChart>
</template>

<style scoped>
.sunburst-total {
  font-size: 22px;
  font-weight: 600;
  line-height: 30px;
}

.sunburst-label {
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
