<script setup>
import { ref } from 'vue'

const time = ref('09:30')
</script>

<template>
  <DouInputTime
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    v-model="time"
    :size="size"
    style="width: 110px"
  />
  <DouInputTime disabled :model-value="time" style="width: 110px" />
  <DouInputTime invalid style="width: 110px" />
</template>
