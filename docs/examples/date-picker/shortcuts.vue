<script setup>
import { ref } from 'vue'

const format = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function lastDays(days) {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  return [format(start), format(end)]
}
const presets = ref(null)
const shortcuts = [
  { label: '最近 7 天', value: () => lastDays(7) },
  { label: '最近 30 天', value: () => lastDays(30) },
  { label: '最近 90 天', value: () => lastDays(90) },
]
</script>

<template>
  <DouDatePicker v-model="presets" range :shortcuts="shortcuts" style="width: 280px" />
</template>
