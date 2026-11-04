<script setup>
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <DouPopover v-model:open="open" title="删除这个分支？" :width="260">
    <DouButton variant="outline" tone="danger">删除分支</DouButton>
    <template #content="{ close }">
      <DouText as="div" variant="secondary" size="sm">
        关联的预览部署也会一并移除，此操作无法撤销。
      </DouText>
      <DouSpace size="sm" justify="end" block style="margin-top: 12px">
        <DouButton variant="ghost" size="sm" @click="close">取消</DouButton>
        <DouButton tone="danger" size="sm" @click="close">删除</DouButton>
      </DouSpace>
    </template>
  </DouPopover>
</template>
