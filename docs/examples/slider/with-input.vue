<script setup>
import { ref } from 'vue'

const volume = ref(40)
const opacity = ref(0.8)
</script>

<template>
  <DouSlider v-model="volume" show-input aria-label="音量" />
  <DouSlider
    v-model="opacity"
    show-input
    :min="0"
    :max="1"
    :step="0.05"
    size="sm"
    aria-label="不透明度"
  />
</template>
