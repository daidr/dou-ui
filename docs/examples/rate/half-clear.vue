<script setup>
import { ref } from 'vue'

const half = ref(3.5)
const clearable = ref(4)
</script>

<template>
  <DouRate v-model="half" allow-half />
  <DouRate v-model="clearable" clearable />
</template>
