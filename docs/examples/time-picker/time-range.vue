<script setup>
import { ref } from 'vue'

const range = ref(['09:00', '18:00'])
</script>

<template>
  <DouTimePicker v-model="range" range clearable style="width: 240px" />
</template>
