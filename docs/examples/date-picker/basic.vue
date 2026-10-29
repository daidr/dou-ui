<script setup>
import { ref } from 'vue'

const date = ref('2026-10-28')
</script>

<template>
  <DouDatePicker v-model="date" style="width: 200px" />
  <DouText variant="tertiary" size="sm">{{ date }}</DouText>
</template>
