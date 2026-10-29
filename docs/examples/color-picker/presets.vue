<script setup>
import { ref } from 'vue'

const preset = ref('#a8572d')
const presets = [
  '#1f2328',
  '#3f56b5',
  '#2e7d5b',
  '#a8572d',
  '#b23a48',
  '#7a4fb5',
  '#5c6670',
  '#c99a2e',
]
const empty = ref(null)
</script>

<template>
  <DouColorPicker v-model="preset" :presets="presets" />
  <DouColorPicker v-model="empty" :presets="presets" clearable />
  <DouColorPicker v-model="preset" :presets="presets" :show-text="false" />
</template>
