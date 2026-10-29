<script setup>
import { ref } from 'vue'

const color = ref('#3f56b5')
</script>

<template>
  <DouColorPicker
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    :size="size"
    :model-value="color"
  />
  <DouColorPicker disabled :model-value="color" />
  <DouColorPicker invalid :model-value="null" />
</template>
