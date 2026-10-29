<script setup>
import { ref } from 'vue'

const keywords = ref(['设计系统', 'Vue'])
</script>

<template>
  <DouInputTag v-model="keywords" placeholder="输入关键词后回车" clearable />
  <DouText size="sm" variant="tertiary">{{ keywords }}</DouText>
</template>
