<script setup>
import { ref } from 'vue'

const week = ref('2026-W44')
</script>

<template>
  <DouDatePicker v-model="week" type="week" style="width: 160px" />
</template>
