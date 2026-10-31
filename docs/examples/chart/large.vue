<script setup>
import { DouButton, DouSpace } from 'dou-ui'
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'
import { shallowRef } from 'vue'

// 大数据放在 shallowRef 里：数组整体替换，不需要逐项响应
const rows = shallowRef([])
const count = shallowRef(0)

function generate(n) {
  const start = new Date(2026, 9, 1).getTime()
  const next = Array.from({ length: n })
  let value = 50
  for (let i = 0; i < n; i++) {
    value += (Math.random() - 0.5) * 2 + (50 - value) * 0.001
    next[i] = { time: start + i * 1000, value }
  }
  rows.value = next
  count.value = n
}

generate(100_000)
</script>

<template>
  <div class="large">
    <DouSpace>
      <DouButton size="sm" @click="generate(100_000)">10 万点</DouButton>
      <DouButton size="sm" @click="generate(1_000_000)">100 万点</DouButton>
      <span class="count">当前 {{ count.toLocaleString() }} 个点</span>
    </DouSpace>
    <DouChart :data="rows" x="time" :height="280">
      <!-- 时间是毫秒数，用 type 把横轴指定为时间轴 -->
      <DouChartAxis position="bottom" type="time" />
      <DouChartLine y="value" name="读数" :width="1.5" />
    </DouChart>
  </div>
</template>

<style scoped>
.large {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
.count {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
