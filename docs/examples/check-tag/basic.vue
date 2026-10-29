<script setup>
import { ref } from 'vue'

const vue = ref(true)
const ts = ref(false)
const pinned = ref(true)
</script>

<template>
  <DouCheckTag v-model:checked="vue">Vue</DouCheckTag>
  <DouCheckTag v-model:checked="ts">TypeScript</DouCheckTag>
  <DouCheckTag v-model:checked="pinned" tone="primary">已置顶</DouCheckTag>
  <DouCheckTag disabled>已归档</DouCheckTag>
  <DouCheckTag checked disabled>默认</DouCheckTag>
</template>
