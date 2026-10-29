<script setup>
import { ref } from 'vue'

const loading = ref(true)
</script>

<template>
  <DouSwitch v-model="loading">加载中</DouSwitch>
  <DouSkeleton :loading="loading" :lines="2">
    <DouText as="p" variant="secondary"> 最近一次部署于 3 分钟前完成，所有检查均已通过。 </DouText>
  </DouSkeleton>
</template>
