<script setup>
import { ref } from 'vue'

const hours = ref([9, 18])
</script>

<template>
  <DouSlider v-model="hours" range :max="24" />
  <DouText variant="tertiary" size="sm">{{ hours[0] }}:00 – {{ hours[1] }}:00</DouText>
</template>
