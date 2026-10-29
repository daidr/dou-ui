<script setup>
import { ref } from 'vue'

const labels = ref(['bug'])
</script>

<template>
  <DouSelect
    v-model="labels"
    :options="['bug', 'docs', 'feature', 'perf']"
    multiple
    creatable
    placeholder="添加标签"
  />
</template>
