<script setup>
import { ref } from 'vue'

// 生成一年的示例数据：工作日多、周末少
const pad = (n) => String(n).padStart(2, '0')
const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
let seed = 7
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const data = []
for (let i = 0; i < 365; i++) {
  const day = new Date()
  day.setDate(day.getDate() - i)
  const weekend = day.getDay() === 0 || day.getDay() === 6
  const value = Math.max(0, Math.round(random() * (weekend ? 3 : 12) - (weekend ? 1 : 2)))
  data.push({ date: format(day), value })
}

const picked = ref(null)
</script>

<template>
  <div class="wrap">
    <DouCalendarHeatmap :data="data" @select="picked = $event" />
    <DouText variant="tertiary" size="sm">
      {{ picked ? `${picked.date} 提交了 ${picked.value} 次` : '点击某一天查看详情' }}
    </DouText>
  </div>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
</style>
