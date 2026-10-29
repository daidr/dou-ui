<script setup>
import { ref } from 'vue'

const ratio = ref(0.5)
const price = ref(99)
</script>

<template>
  <DouInputNumber v-model="ratio" :min="0" :max="1" :step="0.1" />
  <DouInputNumber v-model="price" :precision="2" :step="0.5" />
</template>
