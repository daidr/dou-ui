<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const full =
  '上海的秋天来得晚，十月底的梧桐还是绿的。\n周末可以沿着徐汇滨江骑一段，从龙美术馆到西岸美术馆大约四公里，路很平，适合慢慢骑。'

const content = ref('')
const streaming = ref(false)
let timer

// Imitates a reply arriving in uneven chunks.
function start() {
  clearInterval(timer)
  content.value = ''
  streaming.value = true
  let index = 0
  timer = setInterval(() => {
    index += 6
    content.value = full.slice(0, index)
    if (index >= full.length) {
      clearInterval(timer)
      streaming.value = false
    }
  }, 180)
}

onMounted(start)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouStreamText :content="content" :streaming="streaming" />
  <div>
    <DouButton size="sm" @click="start">重新播放</DouButton>
  </div>
</template>
