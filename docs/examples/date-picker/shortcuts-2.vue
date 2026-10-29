<script setup>
import { ref } from 'vue'

const format = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function lastDays(days) {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  return [format(start), format(end)]
}
const shortcut = ref(null)
</script>

<template>
  <DouDatePicker v-model="shortcut" range style="width: 280px">
    <template #footer="{ pick }">
      <DouButton variant="ghost" size="sm" @click="pick(lastDays(7))">最近 7 天</DouButton>
      <DouButton variant="ghost" size="sm" @click="pick(lastDays(30))">最近 30 天</DouButton>
    </template>
  </DouDatePicker>
</template>
