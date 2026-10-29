<script setup>
import { ref } from 'vue'

const range = ref(['2026-10-12', '2026-10-24'])
</script>

<template>
  <DouDatePicker v-model="range" range style="width: 280px" />
  <DouText variant="tertiary" size="sm">{{ range?.join(' → ') }}</DouText>
</template>
