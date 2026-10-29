<script setup>
import { ref } from 'vue'

const framework = ref(null)
</script>

<template>
  <DouSelect
    v-model="framework"
    filterable
    clearable
    placeholder="搜索框架"
    :options="['Vue', 'Vite', 'Nuxt', 'VitePress', 'Astro', '静态站点']"
  />
</template>
