<script setup>
import { DouChart, DouChartBar, DouChartRange, DouChartTooltip, DouChartZoom } from '@dou-ui/chart'
import { shallowRef } from 'vue'

// 一个项目两年里每天各状态的缺陷数（累计流图）：最下面是已关闭，往上依次是还没关闭的
const statuses = [
  { key: 'closed', name: '已关闭' },
  { key: 'verifying', name: '待验证' },
  { key: 'fixing', name: '修复中' },
  { key: 'open', name: '待处理' },
]

function generate(days) {
  let seed = 20261110
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const end = new Date(2026, 10, 10)
  const rows = []
  let open = 0
  let fixing = 0
  let verifying = 0
  let closed = 0
  for (let i = 0; i < days; i++) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1 + i)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    // 每 6 周发一次版：发版后的一周新提的缺陷多，发版前两周集中验证、关闭
    const cycle = i % 42
    const created = weekend
      ? Math.round(random() * 2)
      : Math.round(random() * 8 + (cycle < 7 ? 10 : 2))
    const toFixing = weekend ? 0 : Math.min(open, Math.round(random() * 12))
    const toVerifying = weekend ? 0 : Math.min(fixing, Math.round(random() * 10))
    const toClosed = weekend
      ? 0
      : Math.min(verifying, Math.round(random() * (cycle >= 32 ? 30 : 6)))
    open += created - toFixing
    fixing += toFixing - toVerifying
    verifying += toVerifying - toClosed
    closed += toClosed
    rows.push({ day, open, fixing, verifying, closed })
  }
  return rows
}

// 数据放在 shallowRef 里，Vue 不必为每一行创建响应式代理
const rows = shallowRef(generate(730))
// 和各项的数字一样带千分位
const number = new Intl.NumberFormat('zh-CN')
const total = (items) => number.format(items.reduce((sum, item) => sum + item.value, 0))
</script>

<template>
  <DouChart :data="rows" x="day" :height="320">
    <DouChartBar
      v-for="status in statuses"
      :key="status.key"
      :y="status.key"
      :name="status.name"
      stack
    />
    <DouChartTooltip v-slot="{ title, items }">
      <div class="tip-title">{{ title }} 累计 {{ total(items) }} 个</div>
      <!-- active：指针所在的那一段，和默认的提示框一样加粗 -->
      <div
        v-for="item in items"
        :key="item.name"
        class="tip-row"
        :class="{ 'is-active': item.active }"
      >
        <span class="tip-swatch" :style="{ background: item.color }" />
        <span class="tip-name">{{ item.name }}</span>
        <span>{{ item.text }}</span>
      </div>
    </DouChartTooltip>
    <DouChartZoom />
    <DouChartRange />
  </DouChart>
</template>

<style scoped>
.tip-title {
  margin-bottom: 6px;
  color: var(--dou-color-text);
  font-weight: var(--dou-font-weight-medium);
}

.tip-row {
  display: flex;
  gap: 6px;
  align-items: center;
  line-height: 20px;
}

.tip-row.is-active {
  color: var(--dou-color-text);
  font-weight: var(--dou-font-weight-medium);
}

.tip-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.tip-name {
  flex: 1;
  margin-right: 12px;
}
</style>
