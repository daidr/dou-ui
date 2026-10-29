<script setup>
import { ref } from 'vue'

const time = ref('09:30')
</script>

<template>
  <DouTimePicker
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    :size="size"
    :model-value="time"
    style="width: 130px"
  />
  <DouTimePicker disabled :model-value="time" style="width: 130px" />
  <DouTimePicker invalid style="width: 130px" />
</template>
