<script setup>
import { dialog, toast } from 'dou-ui'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function removeProject() {
  const ok = await dialog.confirm({
    title: '删除项目？',
    content: '项目 dou-ui 的全部部署、域名与环境变量都会被永久删除，此操作无法撤销。',
    tone: 'danger',
    confirmText: '删除',
    onConfirm: () => sleep(1200),
  })
  if (ok) toast.success('已删除')
}
const showAlert = () =>
  dialog.alert({ title: '部署完成', content: 'dou-ui 已上线。', tone: 'success' })
async function rename() {
  const name = await dialog.prompt({
    title: '重命名项目',
    defaultValue: 'dou-ui',
    placeholder: '项目名称',
    validate: (value) =>
      /^[a-z0-9-]{3,}$/.test(value) ? true : '只能用小写字母、数字和连字符，至少 3 个字符',
  })
  if (name !== null) toast(`已改名为 ${name}`)
}
</script>

<template>
  <DouButton variant="outline" tone="danger" @click="removeProject">删除项目</DouButton>
  <DouButton variant="outline" @click="showAlert">完成提示</DouButton>
  <DouButton variant="outline" @click="rename">重命名</DouButton>
</template>
