<script setup>
import { ref } from 'vue'

const date = ref('2026-10-28')
</script>

<template>
  <DouDatePicker
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    :size="size"
    :model-value="date"
    style="width: 180px"
  />
  <DouDatePicker disabled :model-value="date" style="width: 180px" />
  <DouDatePicker invalid style="width: 180px" />
</template>
