<script setup>
import { ref } from 'vue'

const range = ref('周')
</script>

<template>
  <DouSegmentedControl v-model="range" :options="['日', '周', '月', '年']" />
</template>
