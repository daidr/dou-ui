<script setup>
import { ref } from 'vue'

const price = ref(99)
const memory = ref(512)
</script>

<template>
  <DouInputNumber v-model="memory" :min="128" :max="4096" :step="128">
    <template #suffix>MB</template>
  </DouInputNumber>
  <DouInputNumber v-model="price" :precision="2" :controls="false">
    <template #prefix>¥</template>
  </DouInputNumber>
</template>
