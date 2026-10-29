<script setup>
import { toast } from 'dou-ui'

const undo = () => toast('已撤销')
</script>

<template>
  <DouButton
    variant="outline"
    @click="toast({ message: '已删除 3 个预览部署', action: { label: '撤销', onClick: undo } })"
  >
    删除
  </DouButton>
</template>
