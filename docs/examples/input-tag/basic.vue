<script setup>
import { ref } from 'vue'

const keywords = ref([
  '设计系统',
  'Vue',
  '上海市浦东新区世纪大道沿线商业综合体、甲级写字楼与配套公寓的招商推广方案',
])
</script>

<template>
  <DouInputTag v-model="keywords" placeholder="输入关键词后回车" clearable />
  <DouText size="sm" variant="tertiary">{{ keywords }}</DouText>
</template>
