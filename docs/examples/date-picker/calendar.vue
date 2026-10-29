<script setup>
import { ref } from 'vue'

const inline = ref('2026-10-28')
</script>

<template>
  <DouCard padding="sm"><DouCalendar v-model="inline" /></DouCard>
</template>
