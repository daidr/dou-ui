<script setup>
import { ref } from 'vue'

const count = ref(5)
</script>

<template>
  <DouBadge :value="count">
    <DouButton variant="outline">消息</DouButton>
  </DouBadge>
  <DouBadge :value="128">
    <DouAvatar name="Ada Lovelace" shape="square" />
  </DouBadge>
  <DouBadge :value="3" tone="danger">
    <DouButton variant="outline">错误</DouButton>
  </DouBadge>
  <DouButton variant="ghost" size="sm" @click="count++">+1</DouButton>
  <DouButton variant="ghost" size="sm" @click="count = 0">清零</DouButton>
</template>
