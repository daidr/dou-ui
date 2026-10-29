<script setup>
import { ref } from 'vue'

const score = ref(3)
</script>

<template>
  <DouRate v-model="score" aria-label="满意度" />
  <DouText variant="tertiary" size="sm">{{ score }}</DouText>
</template>
