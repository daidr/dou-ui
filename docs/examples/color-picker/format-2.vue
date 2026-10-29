<script setup>
import { ref } from 'vue'

const formatted = ref('oklch(0.55 0.15 255)')
const fmt = ref('oklch')
</script>

<template>
  <DouColorPicker v-model="formatted" :format="fmt" show-alpha />
  <DouText variant="tertiary" size="sm">{{ formatted }}</DouText>
</template>
