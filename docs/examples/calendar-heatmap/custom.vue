<script setup>
const pad = (n) => String(n).padStart(2, '0')
const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const end = new Date()
const start = new Date(end)
start.setMonth(start.getMonth() - 5, 1)

let seed = 3
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const data = []
const days = Math.round((end - start) / 86_400_000)
for (let i = 0; i <= days; i++) {
  const day = new Date(start)
  day.setDate(start.getDate() + i)
  if (random() > 0.45) data.push({ date: format(day), value: Math.ceil(random() * 8) })
}
</script>

<template>
  <DouCalendarHeatmap
    :data="data"
    :start="format(start)"
    :end="format(end)"
    tone="success"
    :thresholds="[1, 3, 6]"
    :week-start="1"
  >
    <template #tooltip="{ date, value }">
      {{ value ? `${value} 次部署` : '没有部署' }} · {{ date }}
    </template>
  </DouCalendarHeatmap>
</template>
