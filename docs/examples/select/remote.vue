<script setup>
import { ref } from 'vue'

const packages = [
  'dou-ui',
  '@dou-ui/theme',
  '@dou-ui/icons',
  '@dou-ui/resolver',
  'vue',
  'vue-router',
  'pinia',
  'vite',
  'vitest',
  'vitepress',
  'typescript',
  'oxlint',
]
const remoteOptions = ref([])
const remoteLoading = ref(false)
const remoteValue = ref(null)
let remoteTimer
function search(query) {
  remoteLoading.value = true
  clearTimeout(remoteTimer)
  remoteTimer = setTimeout(() => {
    const text = query.trim().toLowerCase()
    remoteOptions.value = packages
      .filter((name) => name.includes(text))
      .map((name) => ({ value: name, label: name }))
    remoteLoading.value = false
  }, 600)
}
</script>

<template>
  <DouSelect
    v-model="remoteValue"
    :options="remoteOptions"
    :loading="remoteLoading"
    remote
    clearable
    placeholder="搜索 npm 包"
    @search="search"
  />
</template>
