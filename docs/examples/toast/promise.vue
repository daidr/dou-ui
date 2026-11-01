<script setup>
import { toast } from 'dou-ui'

const wait = (ms, fail) =>
  new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error('网络超时')) : resolve(12)), ms),
  )

function save() {
  toast.promise(wait(1500), {
    loading: '正在保存草稿…',
    success: (count) => `已保存 ${count} 处修改`,
    error: '保存失败',
  })
}

function publish() {
  toast
    .promise(wait(1500, true), {
      loading: '正在发布…',
      success: '已发布',
      error: (error) => ({ title: '发布失败', message: error.message, closable: true }),
    })
    .catch(() => {})
}
</script>

<template>
  <DouButton variant="outline" @click="save">保存草稿</DouButton>
  <DouButton variant="outline" @click="publish">发布（会失败）</DouButton>
</template>
