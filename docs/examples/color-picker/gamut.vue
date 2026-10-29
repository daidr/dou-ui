<script setup>
import { ref } from 'vue'

const wide = ref('oklch(0.7 0.3 150)')
</script>

<template>
  <DouColorPicker v-model="wide" panel="oklch" format="oklch" gamut="none" />
  <DouText variant="tertiary" size="sm">{{ wide }}</DouText>
</template>
