<script setup>
import { PaperclipIcon, RefreshIcon, SparklesIcon } from '@dou-ui/icons'
import { onBeforeUnmount, ref } from 'vue'

const messages = ref([
  { id: 1, role: 'user', text: '这周六上海适合骑车吗？' },
  {
    id: 2,
    role: 'assistant',
    reasoning: '先查周六的天气，再看风力和降雨时段，最后给出出门时间建议。',
    duration: 4,
    tool: {
      name: 'get_weather',
      input: { city: '上海', date: '周六' },
      output: { weather: '多云', high: 24, low: 18, rain: '17:00 后' },
    },
    text: '适合。周六多云，18 到 24 度，风不大。下午五点后可能下雨，建议上午出门，沿徐汇滨江骑到前滩，往返大约两小时。',
  },
])

const text = ref('')
const loading = ref(false)
let timers = []
let id = 3

const reasoning = '用户想要一条具体路线。考虑距离适中、车少、沿途有休息点，滨江步道最合适。'
const answer =
  '推荐这条：从龙美术馆出发，沿滨江向南经过西岸美术馆、徐汇跑道公园，到前滩休闲公园折返，全程约 16 公里。沿途有很多咖啡店，可以在西岸梦中心歇一会儿。'

function later(fn, ms) {
  timers.push(setTimeout(fn, ms))
}

function play(target, key, full, step, done) {
  let index = 0
  const timer = setInterval(() => {
    index += step
    target[key] = full.slice(0, index)
    if (index >= full.length) {
      clearInterval(timer)
      done()
    }
  }, 120)
  timers.push(timer)
}

function send(value) {
  messages.value.push({ id: id++, role: 'user', text: value })
  text.value = ''
  loading.value = true
  messages.value.push({ id: id++, role: 'assistant', pending: true, text: '', reasoning: '' })
  const reply = messages.value.at(-1)
  later(() => {
    reply.pending = false
    reply.thinking = true
    play(reply, 'reasoning', reasoning, 2, () => {
      reply.thinking = false
      reply.streaming = true
      play(reply, 'text', answer, 4, finish)
    })
  }, 800)
}

function finish() {
  const reply = messages.value.at(-1)
  reply.thinking = false
  reply.streaming = false
  reply.pending = false
  loading.value = false
}

function stop() {
  timers.forEach((timer) => (clearTimeout(timer), clearInterval(timer)))
  timers = []
  finish()
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="chat">
    <DouChatList class="list">
      <template v-for="message in messages" :key="message.id">
        <DouChatBubble v-if="message.role === 'user'" placement="end" :content="message.text" />
        <DouChatBubble v-else variant="plain" :loading="message.pending">
          <template #avatar>
            <DouAvatar><SparklesIcon /></DouAvatar>
          </template>
          <div class="reply">
            <DouChatReasoning
              v-if="message.reasoning"
              :thinking="message.thinking"
              :duration="message.duration"
            >
              <DouStreamText
                :content="message.reasoning"
                :streaming="message.thinking"
                :caret="false"
              />
            </DouChatReasoning>
            <DouChatToolCall v-if="message.tool" v-bind="message.tool" />
            <DouStreamText
              v-if="message.text"
              :content="message.text"
              :streaming="message.streaming"
            />
          </div>
          <template v-if="!message.thinking && !message.streaming" #footer>
            <DouCopyButton :text="message.text" />
            <DouButton variant="ghost" size="sm" aria-label="重新生成"><RefreshIcon /></DouButton>
          </template>
        </DouChatBubble>
      </template>
    </DouChatList>
    <DouChatInput v-model="text" class="input" :loading="loading" @submit="send" @stop="stop">
      <template #actions>
        <DouButton variant="ghost" size="sm" aria-label="添加附件"><PaperclipIcon /></DouButton>
      </template>
    </DouChatInput>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 560px;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-canvas);
}

.list {
  flex: 1 1 auto;
}

.reply {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input {
  flex: none;
  width: auto;
  margin: 0 16px 16px;
}
</style>
