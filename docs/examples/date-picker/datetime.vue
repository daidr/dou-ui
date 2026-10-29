<script setup>
import { ref } from 'vue'

const datetime = ref('2026-10-28 14:30')
</script>

<template>
  <DouDatePicker v-model="datetime" type="datetime" style="width: 220px" />
  <DouText variant="tertiary" size="sm">{{ datetime }}</DouText>
</template>
