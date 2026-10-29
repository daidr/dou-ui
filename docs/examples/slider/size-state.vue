<script setup>
import { ref } from 'vue'

const quality = ref(75)
</script>

<template>
  <DouSlider v-model="quality" size="sm" aria-label="sm" />
  <DouSlider v-model="quality" aria-label="md" />
  <DouSlider v-model="quality" size="lg" aria-label="lg" />
  <DouSlider :model-value="60" invalid aria-label="无效" />
  <DouSlider :model-value="30" disabled aria-label="禁用" />
</template>
