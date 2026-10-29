<script setup>
import { ref } from 'vue'

const limited = ref(null)
const noWeekend = (value) => {
  const day = new Date(value).getUTCDay()
  return day === 0 || day === 6
}
</script>

<template>
  <DouDatePicker
    v-model="limited"
    min="2026-10-01"
    max="2026-11-30"
    :disabled-date="noWeekend"
    placeholder="十月至十一月的工作日"
    style="width: 240px"
    clearable
  />
</template>
