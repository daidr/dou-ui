<script setup>
import { ref } from 'vue'

const wheel = ref('#3f56b5')
const sliders = ref('oklch(0.62 0.14 160)')
</script>

<template>
  <DouColorPicker v-model="wheel" panel="wheel" />
  <DouColorPicker v-model="sliders" panel="oklch" format="oklch" />
</template>
