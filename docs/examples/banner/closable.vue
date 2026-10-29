<script setup>
import { ref } from 'vue'

const open = ref(true)
</script>

<template>
  <DouBanner v-model:open="open" tone="success" closable>你的空间已扩容到 50 GB。</DouBanner>
  <div v-if="!open">
    <DouButton size="sm" @click="open = true">重新显示</DouButton>
  </div>
</template>
