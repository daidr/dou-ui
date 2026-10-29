<script setup>
import { ref } from 'vue'

const temperature = ref(24)
</script>

<template>
  <DouSlider
    v-model="temperature"
    :min="16"
    :max="32"
    :step="2"
    :marks="{ 16: '16°C', 24: '24°C', 32: '32°C' }"
    :format-value="(v) => `${v} 摄氏度`"
    aria-label="温度"
  />
</template>
