<script setup>
import { ref } from 'vue'

const many = Array.from({ length: 5000 }, (_, i) => ({ key: i, label: `条目 ${i + 1}` }))
const manyChosen = ref([])
</script>

<template>
  <DouTransfer v-model="manyChosen" :data="many" filterable :height="200" />
</template>
