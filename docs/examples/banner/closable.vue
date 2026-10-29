<script setup>
import { ref } from 'vue'

const key = ref('demo-notice-1')
function again() {
  // a new key shows the notice again, as for the next announcement
  key.value = `demo-notice-${Date.now()}`
}
</script>

<template>
  <DouBanner :key="key" tone="success" closable :storage-key="key">
    你的空间已扩容到 50 GB。关闭后刷新页面也不会再出现。
  </DouBanner>
  <DouButton size="sm" @click="again">换一条公告</DouButton>
</template>
