<script setup>
import { ref } from 'vue'

const text = ref('')
</script>

<template>
  <DouInput v-model="text" placeholder="项目名称" style="width: 240px" />
  <DouText variant="tertiary" size="sm">当前值：{{ text || '（空）' }}</DouText>
</template>
