<script setup>
import { ref } from 'vue'

const month = ref('2026-10')
const year = ref('2026')
</script>

<template>
  <DouDatePicker v-model="month" type="month" style="width: 160px" />
  <DouDatePicker v-model="year" type="year" style="width: 140px" />
</template>
