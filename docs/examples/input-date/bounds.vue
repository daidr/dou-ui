<script setup>
import { ref } from 'vue'

const date = ref('2026-11-12')
const weekday = (day) => [0, 6].includes(new Date(`${day}T00:00`).getDay())
</script>

<template>
  <DouInputDate
    v-model="date"
    min="2026-11-01"
    max="2026-11-30"
    :disabled-date="weekday"
    style="width: 160px"
  />
  <DouText variant="tertiary" size="sm">{{ date ?? 'null' }}</DouText>
</template>
