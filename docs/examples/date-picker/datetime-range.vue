<script setup>
import { ref } from 'vue'

const datetimeRange = ref(null)
</script>

<template>
  <DouDatePicker
    v-model="datetimeRange"
    type="datetime"
    range
    style="width: 360px; max-width: 100%"
    clearable
  />
  <DouText variant="tertiary" size="sm">{{ datetimeRange?.join(' → ') }}</DouText>
</template>
