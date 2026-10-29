<script setup>
import { ref } from 'vue'

const basic = ref(false)
</script>

<template>
  <DouButton variant="outline" @click="basic = true">删除项目</DouButton>
  <DouDialog v-model:open="basic" title="删除项目？" :width="420">
    <DouText as="p" variant="secondary">
      项目 dou-ui 的全部部署、域名与环境变量都会被永久删除，此操作无法撤销。
    </DouText>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton tone="danger" @click="close">删除</DouButton>
    </template>
  </DouDialog>
</template>
