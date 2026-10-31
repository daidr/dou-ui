<script setup>
import { ref } from 'vue'

const time = ref('09:30')
// 营业时间 09:00–18:00，12 点午休
const businessHours = {
  hour: (hour) => hour < 9 || hour > 18 || hour === 12,
  minute: (minute, hour) => hour === 18 && minute > 0,
}
</script>

<template>
  <DouTimePicker
    v-model="time"
    :minute-step="15"
    :disabled-time="businessHours"
    style="width: 140px"
  />
</template>
