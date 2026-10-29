<script setup>
import { ref } from 'vue'

const date = ref('2026-10-29')
</script>

<template>
  <DouInputDate
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    v-model="date"
    :size="size"
    style="width: 160px"
  />
  <DouInputDate readonly :model-value="date" style="width: 160px" />
  <DouInputDate disabled :model-value="date" style="width: 160px" />
  <DouInputDate invalid style="width: 160px" />
</template>
