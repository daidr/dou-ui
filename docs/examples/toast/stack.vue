<script setup>
import { ref } from 'vue'
import { toast } from 'dou-ui'

const stacked = ref(true)

const notes = [
  () => toast('戴兜 评论了《季度计划》'),
  () => toast.success('sh-02 节点部署完成', { title: '部署' }),
  () => toast({ message: '已归档 3 个任务', action: { label: '撤销', onClick: () => {} } }),
  () => toast.warning('存储空间已用 90%', { closable: true }),
]
let next = 0
const one = () => notes[next++ % notes.length]()
const burst = () => notes.forEach((show, index) => setTimeout(show, index * 160))
</script>

<template>
  <DouButton variant="outline" @click="one">再来一条</DouButton>
  <DouButton variant="outline" @click="burst">连续四条</DouButton>
  <label style="display: inline-flex; gap: 8px; align-items: center">
    <DouSwitch v-model="stacked" />
    堆叠
  </label>
  <DouToastViewport v-if="!stacked" :stacked="false" />
</template>
