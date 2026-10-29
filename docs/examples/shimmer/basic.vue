<script setup>
import { ref } from 'vue'

const active = ref(true)
</script>

<template>
  <DouShimmer :active="active">正在生成回答…</DouShimmer>
  <DouShimmer :active="active" :duration="4">正在读取 3 个文件</DouShimmer>
  <DouSwitch v-model="active" />
</template>
