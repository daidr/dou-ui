<script setup>
import { ref } from 'vue'

const quarter = ref('2026-Q4')
const quarters = ref(['2026-Q1', '2026-Q3'])
</script>

<template>
  <DouDatePicker v-model="quarter" type="quarter" style="width: 200px" />
  <DouDatePicker v-model="quarters" type="quarter" range style="width: 400px" />
</template>
