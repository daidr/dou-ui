<script setup>
import { ref } from 'vue'

const value = ref(64)
</script>

<template>
  <DouProgress :value="value" show-value />
  <DouSlider v-model="value" />
</template>
