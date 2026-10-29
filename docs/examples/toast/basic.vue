<script setup>
import { toast } from 'dou-ui'
</script>

<template>
  <DouButton variant="outline" @click="toast('链接已复制')">轻提示</DouButton>
  <DouButton variant="outline" @click="toast.success('dou-ui.dev 已上线', { title: '部署完成' })">
    成功
  </DouButton>
  <DouButton variant="outline" @click="toast.warning('构建缓存即将过期')">警告</DouButton>
  <DouButton
    variant="outline"
    @click="toast.danger('网络连接已断开', { closable: true, duration: 0 })"
  >
    错误
  </DouButton>
</template>
