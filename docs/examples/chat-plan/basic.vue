<script setup>
import { onBeforeUnmount, ref } from 'vue'

const labels = ['读取需求文档', '列出要改的组件', '修改样式', '运行测试', '提交代码']
const items = ref([])
let timer

function start() {
  clearInterval(timer)
  items.value = labels.map((label) => ({ label, status: 'pending' }))
  let index = 0
  items.value[0].status = 'running'
  timer = setInterval(() => {
    items.value[index].status = 'done'
    index++
    if (index >= items.value.length) return clearInterval(timer)
    items.value[index].status = 'running'
  }, 1200)
}

start()
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouChatPlan :items="items" />
  <div>
    <DouButton size="sm" @click="start">重新开始</DouButton>
  </div>
</template>
