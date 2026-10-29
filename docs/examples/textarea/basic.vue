<script setup>
import { ref } from 'vue'

const bio = ref('')
</script>

<template>
  <DouTextarea v-model="bio" placeholder="介绍一下这个项目" />
  <DouText variant="tertiary" size="sm">已输入 {{ bio.length }} 个字符</DouText>
</template>
