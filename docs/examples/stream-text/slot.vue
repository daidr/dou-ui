<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const full = '第一步：确定路线。\n第二步：查看天气。\n第三步：约上朋友。'

const content = ref('')
const streaming = ref(false)
let timer

function start() {
  clearInterval(timer)
  content.value = ''
  streaming.value = true
  let index = 0
  timer = setInterval(() => {
    index += 4
    content.value = full.slice(0, index)
    if (index >= full.length) {
      clearInterval(timer)
      streaming.value = false
    }
  }, 200)
}

onMounted(start)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouStreamText :content="content" :streaming="streaming" :speed="20" :caret="false">
    <template #default="{ text, done }">
      <ol class="steps">
        <li v-for="(line, index) in text.split('\n')" :key="index">{{ line }}</li>
      </ol>
      <DouShimmer v-if="!done">正在生成…</DouShimmer>
    </template>
  </DouStreamText>
  <div>
    <DouButton size="sm" @click="start">重新播放</DouButton>
  </div>
</template>

<style scoped>
.steps {
  margin: 0 0 4px;
  padding-left: 20px;
}
</style>
