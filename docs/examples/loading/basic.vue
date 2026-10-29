<script setup>
import { ref } from 'vue'

const loading = ref(true)
</script>

<template>
  <DouSwitch v-model="loading">加载中</DouSwitch>
  <DouLoading :loading="loading" text="正在加载部署记录">
    <DouCard title="最近部署" style="width: 100%">
      <DouText as="p" variant="secondary">dou-ui · main · 2 分钟前</DouText>
      <DouText as="p" variant="secondary">dou-ui · feat/table · 1 小时前</DouText>
      <DouText as="p" variant="secondary">dou-icons · main · 昨天</DouText>
    </DouCard>
  </DouLoading>
</template>
