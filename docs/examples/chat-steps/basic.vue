<script setup>
import { FileTextIcon, GlobeIcon, SearchIcon } from '@dou-ui/icons'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const all = [
  { label: '搜索网页', detail: '上海 周末 展览', icon: SearchIcon },
  { label: '阅读网页', detail: 'westbund.example.com', icon: GlobeIcon },
  { label: '阅读网页', detail: 'museum.example.com', icon: GlobeIcon },
  { label: '整理结果', icon: FileTextIcon },
]
const items = ref([])
let timer

function start() {
  clearInterval(timer)
  items.value = [{ ...all[0], status: 'running' }]
  timer = setInterval(() => {
    const index = items.value.length
    items.value.at(-1).status = 'done'
    if (index >= all.length) return clearInterval(timer)
    items.value.push({ ...all[index], status: 'running' })
  }, 1200)
}

onMounted(start)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouChatSteps :items="items" open />
  <div>
    <DouButton size="sm" @click="start">重新开始</DouButton>
  </div>
</template>
