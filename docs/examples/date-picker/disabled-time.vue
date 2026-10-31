<script setup>
import { ref } from 'vue'

const pad = (value) => String(value).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const at = ref(null)
// 不能早于今天，今天只能选现在以后的时间
const disabledDate = (date) => date < today
const disabledTime = (date) => {
  if (date !== today) return
  const hour = new Date().getHours()
  const minute = new Date().getMinutes()
  return {
    hour: (h) => h < hour,
    minute: (m, h) => h === hour && m <= minute,
  }
}
</script>

<template>
  <DouDatePicker
    v-model="at"
    type="datetime"
    placeholder="预约时间"
    :disabled-date="disabledDate"
    :disabled-time="disabledTime"
  />
</template>
