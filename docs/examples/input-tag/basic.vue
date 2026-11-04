<script setup>
import { ref } from 'vue'

const keywords = ref([
  '设计系统',
  'Vue',
  '一个很长的关键词，放不下时以省略号结尾，悬停可以看到完整内容',
])
</script>

<template>
  <DouInputTag v-model="keywords" placeholder="输入关键词后回车" clearable />
  <DouText size="sm" variant="tertiary">{{ keywords }}</DouText>
</template>
