<script setup>
import { ref } from 'vue'

const page = ref(false)
function openPage() {
  page.value = true
  setTimeout(() => (page.value = false), 1500)
}
</script>

<template>
  <DouButton variant="outline" @click="openPage">全屏加载 1.5 秒</DouButton>
  <DouLoading :loading="page" fullscreen text="正在切换团队" />
</template>
