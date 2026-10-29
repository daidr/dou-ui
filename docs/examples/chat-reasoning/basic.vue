<script setup>
import { onBeforeUnmount, ref } from 'vue'

const full =
  '用户想知道周末去哪儿骑车。先确认城市是上海，再看天气：周六多云，周日有雨，所以推荐周六。路线要平坦、车少，滨江步道比较合适。'

const thinking = ref(false)
const content = ref('')
let timer

function start() {
  clearInterval(timer)
  content.value = ''
  thinking.value = true
  let index = 0
  timer = setInterval(() => {
    index += 4
    content.value = full.slice(0, index)
    if (index >= full.length) {
      clearInterval(timer)
      thinking.value = false
    }
  }, 150)
}

start()
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouChatReasoning :thinking="thinking">
    <DouStreamText :content="content" :streaming="thinking" :caret="false" />
  </DouChatReasoning>
  <div>
    <DouButton size="sm" :disabled="thinking" @click="start">重新思考</DouButton>
  </div>
</template>
