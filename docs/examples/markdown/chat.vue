<script setup>
import { createCodeHighlighter, typescript } from '@dou-ui/code'
import { onBeforeUnmount, onMounted, ref } from 'vue'

// One highlighter for every code block, in the code editor's colors.
const defaults = { DouCodeBlock: { highlight: createCodeHighlighter([typescript]) } }

const sources = [
  { title: '上海市气象局', url: 'https://weather.example.com', description: '周六多云转小雨。' },
  { title: '城市骑行指南', url: 'https://ride.example.com', description: '滨江骑行路线与租车点。' },
]
const full = `周六上海**多云转小雨**[1]，建议上午出门。滨江的骑行道全程约 4 公里[2]：

- 上午九点前人少
- 雨天路面湿滑，注意减速

可以用下面的函数估算骑行时间：

\`\`\`ts
function rideMinutes(km: number, speed = 12): number {
  return Math.round((km / speed) * 60)
}
\`\`\``

const text = ref('')
const streaming = ref(false)
let timer

function start() {
  clearTimeout(timer)
  text.value = ''
  streaming.value = true
  let index = 0
  const next = () => {
    index += 3 + Math.floor(Math.random() * 6)
    text.value = full.slice(0, index)
    if (index >= full.length) streaming.value = false
    else timer = setTimeout(next, 50 + Math.random() * 80)
  }
  next()
}

onMounted(start)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <DouConfigProvider :defaults="defaults">
    <DouChatMessage
      markdown
      :parts="[
        { type: 'text', text, streaming },
        ...(streaming ? [] : [{ type: 'sources', items: sources }]),
      ]"
    />
  </DouConfigProvider>
  <div>
    <DouButton size="sm" @click="start">重新播放</DouButton>
  </div>
</template>
