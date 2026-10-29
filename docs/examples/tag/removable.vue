<script setup>
import { ref } from 'vue'

const tags = ref(['vue', 'bun', 'vite', 'css'])
</script>

<template>
  <DouTag v-for="tag in tags" :key="tag" closable @close="tags = tags.filter((t) => t !== tag)">
    {{ tag }}
  </DouTag>
  <DouButton
    v-if="tags.length < 4"
    variant="ghost"
    size="sm"
    @click="tags = ['vue', 'bun', 'vite', 'css']"
  >
    重置
  </DouButton>
</template>
