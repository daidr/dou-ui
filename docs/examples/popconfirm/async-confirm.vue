<script setup>
import { ref } from 'vue'

const removed = ref(0)
const remove = () =>
  new Promise((resolve) =>
    setTimeout(() => {
      removed.value++
      resolve()
    }, 1000),
  )
let tries = 0
const flaky = () =>
  new Promise((resolve, reject) => setTimeout(() => (++tries % 2 ? reject() : resolve()), 800))
</script>

<template>
  <DouPopconfirm
    title="删除这个项目？"
    description="项目里的部署会一起删除，无法恢复。"
    tone="danger"
    confirm-text="删除"
    @confirm="remove"
  >
    <DouButton tone="danger" variant="soft">删除项目</DouButton>
  </DouPopconfirm>
  <DouPopconfirm title="同步到远端？" description="这个示例每隔一次会失败。" @confirm="flaky">
    <DouButton variant="outline">同步</DouButton>
  </DouPopconfirm>
  <DouText variant="tertiary" size="sm">已删除 {{ removed }} 次</DouText>
</template>
