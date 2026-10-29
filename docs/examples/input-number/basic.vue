<script setup>
import { ref } from 'vue'

const count = ref(3)
</script>

<template>
  <DouInputNumber v-model="count" :min="1" :max="10" />
  <DouText variant="tertiary" size="sm">当前值：{{ count ?? 'null' }}</DouText>
</template>
