<script setup>
import { ref } from 'vue'

const framework = ref('')
const frameworks = ['Vue', 'Vite', 'VitePress', 'Vitest', 'Nuxt', 'Pinia', 'Bun', 'oxlint']
</script>

<template>
  <DouAutocomplete
    v-model="framework"
    :options="frameworks"
    placeholder="喜欢的工具"
    style="width: 240px"
  />
</template>
