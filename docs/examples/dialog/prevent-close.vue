<script setup>
import { ref } from 'vue'
import { dialog } from 'dou-ui'

const guarded = ref(false)
const confirmLeave = () =>
  dialog.confirm({
    title: '放弃修改？',
    content: '有未保存的修改，关闭后会丢失。',
    tone: 'warning',
    confirmText: '放弃',
  })
</script>

<template>
  <DouButton variant="outline" @click="guarded = true">编辑说明</DouButton>
  <DouDialog
    v-model:open="guarded"
    title="编辑说明"
    :before-close="confirmLeave"
    :close-on-mask="false"
  >
    <DouTextarea placeholder="写点什么……" />
  </DouDialog>
</template>
