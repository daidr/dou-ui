<script setup>
import { ref } from 'vue'

const centered = ref(false)
</script>

<template>
  <DouButton variant="outline" @click="centered = true">居中的对话框</DouButton>
  <DouDialog v-model:open="centered" title="已复制" centered :width="360">
    <DouText as="p" variant="secondary">部署地址已复制到剪贴板。</DouText>
  </DouDialog>
</template>
