<script setup>
import { ref } from 'vue'

const volume = ref(40)
</script>

<template>
  <DouSlider v-model="volume" aria-label="音量" />
  <DouText variant="tertiary" size="sm">当前值：{{ volume }}</DouText>
</template>
