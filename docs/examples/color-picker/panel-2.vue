<script setup>
import { ref } from 'vue'

const multi = ref('#a8572d')
</script>

<template>
  <DouColorPicker v-model="multi" :panel="['square', 'wheel', 'oklch', 'rgb']" show-alpha />
</template>
