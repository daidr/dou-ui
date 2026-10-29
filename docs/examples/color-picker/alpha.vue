<script setup>
import { ref } from 'vue'

const alpha = ref('#2e7d5bcc')
</script>

<template>
  <DouColorPicker v-model="alpha" show-alpha />
</template>
