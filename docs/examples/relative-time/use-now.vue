<script setup>
import { computed } from 'vue'
import { useNow } from 'dou-ui'

const now = useNow()
const text = computed(() => new Date(now.value).toLocaleTimeString('zh-CN', { hour12: false }))
</script>

<template>
  <DouText mono size="lg">{{ text }}</DouText>
</template>
