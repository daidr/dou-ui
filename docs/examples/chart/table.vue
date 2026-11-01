<script setup>
import { ref } from 'vue'
import { DouSwitch } from 'dou-ui'
import { DouChart, DouChartAxis, DouChartBar, DouChartLine } from '@dou-ui/chart'

// 上海店各季度的销售额和毛利率
const rows = [
  { q: '一季度', sales: 182, margin: 0.31 },
  { q: '二季度', sales: 214, margin: 0.33 },
  { q: '三季度', sales: 236, margin: 0.29 },
  { q: '四季度', sales: 268, margin: 0.34 },
]
const percent = (v) => `${Math.round(v * 100)}%`

const table = ref(false)
</script>

<template>
  <div class="demo">
    <label class="toggle"><DouSwitch v-model="table" size="sm" />查看数据表</label>
    <DouChart v-model:table="table" :data="rows" x="q" :height="280">
      <DouChartAxis for="x" title="季度" />
      <DouChartAxis for="y" title="销售额（万元）" />
      <DouChartAxis for="y2" title="毛利率" :format="percent" />
      <DouChartBar y="sales" name="销售额" />
      <DouChartLine y="margin" name="毛利率" axis="y2" />
    </DouChart>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--dou-font-size-sm);
}
</style>
